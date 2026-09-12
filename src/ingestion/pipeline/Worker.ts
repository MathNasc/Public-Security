import { db } from '../../db/index.js';
import { dataImports, dataSources, securityOccurrences, securityIndicators, geographicMunicipalities } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { rawStorage } from './Storage.js';
import { analysisCache } from '../../lib/cache.js';
import { GeoNormalizationService } from '../../services/GeoNormalizationService.js';
import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { SspSpAdapter } from '../adapters/ssp/SspSpAdapter.js';
import { SinespAdapter } from '../adapters/sinesp/SinespAdapter.js';
import { IspRjAdapter } from '../adapters/isp-rj/IspRjAdapter.js';
import { SspMgAdapter } from '../adapters/ssp-mg/SspMgAdapter.js';
import { SespPrAdapter } from '../adapters/sesp-pr/SespPrAdapter.js';
import { SspRsAdapter } from '../adapters/ssp-rs/SspRsAdapter.js';
import { SspScAdapter } from '../adapters/ssp-sc/SspScAdapter.js';
import { SspBaAdapter } from '../adapters/ssp-ba/SspBaAdapter.js';
import { SdsPeAdapter } from '../adapters/sds-pe/SdsPeAdapter.js';
import { SspdsCeAdapter } from '../adapters/sspds-ce/SspdsCeAdapter.js';
import { SspDfAdapter } from '../adapters/ssp-df/SspDfAdapter.js';
import { SspGoAdapter } from '../adapters/ssp-go/SspGoAdapter.js';
import { SespAcAdapter } from '../adapters/sesp-ac/SespAcAdapter.js';
import { SspAlAdapter } from '../adapters/ssp-al/SspAlAdapter.js';
import { SspAmAdapter } from '../adapters/ssp-am/SspAmAdapter.js';
import { SejuspApAdapter } from '../adapters/sejusp-ap/SejuspApAdapter.js';
import { SespEsAdapter } from '../adapters/sesp-es/SespEsAdapter.js';
import { SspMaAdapter } from '../adapters/ssp-ma/SspMaAdapter.js';
import { SespMtAdapter } from '../adapters/sesp-mt/SespMtAdapter.js';
import { SejuspMsAdapter } from '../adapters/sejusp-ms/SejuspMsAdapter.js';
import { SegupPaAdapter } from '../adapters/segup-pa/SegupPaAdapter.js';
import { SedsPbAdapter } from '../adapters/seds-pb/SedsPbAdapter.js';
import { SspPiAdapter } from '../adapters/ssp-pi/SspPiAdapter.js';
import { SesedRnAdapter } from '../adapters/sesed-rn/SesedRnAdapter.js';
import { SesdecRoAdapter } from '../adapters/sesdec-ro/SesdecRoAdapter.js';
import { SespRrAdapter } from '../adapters/sesp-rr/SespRrAdapter.js';
import { SspSeAdapter } from '../adapters/ssp-se/SspSeAdapter.js';
import { SspToAdapter } from '../adapters/ssp-to/SspToAdapter.js';

const BATCH_SIZE = 1000;

export interface IngestionMetrics {
  recordsRead: number;
  recordsValid: number;
  recordsInvalid: number;
  recordsDuplicate: number;
  recordsInserted: number;
  recordsWithoutCoordinates: number;
  recordsWithInvalidCoordinates: number;
  recordsWithUnknownMunicipality: number;
}

export class IngestionWorker {
  private workerId: string;
  private muniCache: Map<string, string> = new Map();
  private isRunning = false;

  constructor(workerId?: string) {
    this.workerId = workerId || crypto.randomUUID();
  }
  
  async start() {
    this.isRunning = true;
    console.log(`[IngestionWorker ${this.workerId}] Iniciado loop de processamento.`);
    while (this.isRunning) {
      let job;
      try {
        job = await this.claimJob();
      } catch (e: any) {
        console.error(`[Worker ${this.workerId}] Erro ao buscar job na fila:`, e.message);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      if (job) {
        await this.processJob(job);
      } else {
        await new Promise(r => setTimeout(r, 4000));
      }
    }
  }
  
  stop() {
    this.isRunning = false;
    console.log(`[IngestionWorker ${this.workerId}] Parado com sucesso.`);
  }
  
  private async loadMuniCache() {
    if (this.muniCache.size > 0) return;

    try {
      const munis = await db
        .select({
          code: geographicMunicipalities.code,
          stateAcronym: geographicMunicipalities.stateAcronym,
          normalizedName: geographicMunicipalities.normalizedName
        })
        .from(geographicMunicipalities);

      for (const m of munis) {
        this.muniCache.set(m.stateAcronym + '_' + m.normalizedName, m.code);
      }
      console.log(`[Worker ${this.workerId}] MuniCache carregado com ${this.muniCache.size} municípios.`);
    } catch (e: any) {
      console.warn(`[Worker ${this.workerId}] Aviso ao carregar MuniCache: ${e.message}`);
    }
  }

  private async claimJob() {
    // 1. Busca primeiro job elegível (QUEUED ou travado há mais de 30 minutos)
    const candidates = await db
      .select()
      .from(dataImports)
      .where(eq(dataImports.status, 'QUEUED'))
      .orderBy(dataImports.createdAt)
      .limit(1);

    if (candidates.length === 0) {
      return null;
    }

    const job = candidates[0];

    // 2. Trava atômica com status PROCESSING
    await db
      .update(dataImports)
      .set({
        status: 'PROCESSING',
        workerId: this.workerId,
        lockedAt: new Date(),
        startedAt: job.startedAt || new Date(),
        attempts: (job.attempts || 0) + 1
      })
      .where(eq(dataImports.id, job.id));

    return {
      ...job,
      status: 'PROCESSING',
      attempts: (job.attempts || 0) + 1
    };
  }

  /**
   * Helper para ler e extrair o cabeçalho original do arquivo CSV para validação de schema.
   */
  private async extractCsvHeaders(resolvedPath: string): Promise<string[]> {
    if (!fs.existsSync(resolvedPath)) return [];
    
    const fileStream = fs.createReadStream(resolvedPath, { encoding: 'utf8', highWaterMark: 8192 });
    for await (const chunk of fileStream) {
      fileStream.destroy();
      const lines = chunk.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          const delimiter = trimmed.includes(';') ? ';' : ',';
          return trimmed.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
        }
      }
    }
    return [];
  }

  /**
   * Execução direta de um Job para testes ou processamento manual síncrono.
   */
  public async processJobDirectly(jobOrId: any): Promise<{ success: boolean; metrics: IngestionMetrics; error?: string }> {
    return this.processJob(jobOrId);
  }

  private async processJob(jobOrId: any): Promise<{ success: boolean; metrics: IngestionMetrics; error?: string }> {
    let job = jobOrId;
    if (typeof jobOrId === 'string') {
      const rows = await db.select().from(dataImports).where(eq(dataImports.id, jobOrId));
      if (rows.length === 0) {
        throw new Error(`Job com ID ${jobOrId} não foi encontrado em data_imports.`);
      }
      job = rows[0];
    }

    console.log(`[Worker ${this.workerId}] Iniciando execução do Job: ${job.id} (Fonte: ${job.sourceId || job.source_id})`);
    
    const sourceId = (job.sourceId || job.source_id || '').toUpperCase();
    const rawFilePath = job.rawFilePath || job.raw_file_path;

    const metrics: IngestionMetrics = {
      recordsRead: 0,
      recordsValid: 0,
      recordsInvalid: 0,
      recordsDuplicate: 0,
      recordsInserted: 0,
      recordsWithoutCoordinates: 0,
      recordsWithInvalidCoordinates: 0,
      recordsWithUnknownMunicipality: 0
    };

    try {
      // Step 7: Armazenamento RAW - Validação de integridade do arquivo
      const resolvedPath = path.isAbsolute(rawFilePath) ? rawFilePath : path.join(process.cwd(), rawFilePath);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Arquivo RAW não encontrado no disco: ${rawFilePath}`);
      }

      const fileStat = fs.statSync(resolvedPath);
      if (fileStat.size === 0) {
        throw new Error("Quality Gate: Arquivo vazio (0 bytes). Importação rejeitada.");
      }

      // Step 10: Seleção do Adapter oficial correspondente
      const adapter = this.selectAdapter(sourceId);
      if (!adapter) {
        throw new Error(`Nenhum adapter oficial registrado para a fonte: ${sourceId}`);
      }

      // Step 11: Validação prévia de Schema
      if (typeof adapter.validateSchema === 'function') {
        const headers = await this.extractCsvHeaders(resolvedPath);
        const schemaValidation = adapter.validateSchema(headers);
        if (!schemaValidation.valid) {
          throw new Error(`Quality Gate: Falha na validação de schema do dataset: ${schemaValidation.error}`);
        }
        console.log(`[Worker ${this.workerId}] Schema validado com sucesso. Formato: ${schemaValidation.format}`);
      }

      // Carrega cache de municípios
      await this.loadMuniCache();

      // Step 12: Parsing em Stream de alta performance
      const readStream = fs.createReadStream(resolvedPath);
      const parser = readStream.pipe(parse({
        columns: true,
        delimiter: [';', ','],
        trim: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true
      }));

      let checkpoint = 0;
      let batch: any[] = [];
      const seenKeys = new Set<string>();

      for await (const row of parser) {
        metrics.recordsRead++;

        try {
          // Step 13: Normalização via Adapter
          let results = adapter.parseRow(row);
          if (!results) {
            metrics.recordsInvalid++;
            continue;
          }

          if (!Array.isArray(results)) {
            results = [results];
          }

          for (const result of results) {
            if (!result || !result.data) {
              metrics.recordsInvalid++;
              continue;
            }

            // Step 15: Deduplicação em memória (Idempotência no mesmo lote/arquivo)
            let dedupKey: string;
            if (result.target === 'occurrences') {
              const recordId = result.data.sourceRecordId || result.data.source_record_id || '';
              dedupKey = `occ_${sourceId}_${recordId}`;
            } else {
              const state = result.data.stateCode || result.data.state_code || '';
              const mun = result.data.municipalityCode || result.data.municipalityName || '';
              const cat = result.data.category || '';
              const per = result.data.period || '';
              dedupKey = `ind_${sourceId}_${state}_${mun}_${cat}_${per}`;
            }

            if (dedupKey && seenKeys.has(dedupKey)) {
              metrics.recordsDuplicate++;
              continue;
            }
            if (dedupKey) seenKeys.add(dedupKey);

            // Step 14: Quality Gate - Validação de Coordenadas Geográficas
            if (result.target === 'occurrences') {
              const lat = result.data.latitude;
              const lon = result.data.longitude;
              if (lat !== null && lon !== null && lat !== undefined && lon !== undefined) {
                // Bounds geográficos do Brasil (-35 a +5.5 Lat, -75 a -30 Lon)
                if (lat < -35 || lat > 5.5 || lon < -75 || lon > -30) {
                  metrics.recordsWithInvalidCoordinates++;
                  result.data.latitude = null;
                  result.data.longitude = null;
                }
              } else {
                metrics.recordsWithoutCoordinates++;
              }
            }

            // Resolução de código de município para indicadores e ocorrências
            if (result.target === 'indicators') {
              const munName = result.data.municipalityName || result.data.municipality_name;
              const state = result.data.stateCode || result.data.state_code;
              if (!result.data.municipalityCode && munName && state) {
                const canonical = GeoNormalizationService.canonicalizeMunicipalityName(munName);
                const resolvedCode = this.muniCache.get(state + '_' + canonical);
                if (resolvedCode) {
                  result.data.municipalityCode = resolvedCode;
                } else {
                  metrics.recordsWithUnknownMunicipality++;
                }
              } else if (!result.data.municipalityCode) {
                metrics.recordsWithUnknownMunicipality++;
              }
            } else if (result.target === 'occurrences') {
              const munName = result.data.municipality_name || result.data.municipalityName;
              const state = result.data.state_code || result.data.stateCode;
              if (munName && state && (!result.data.municipality_code && !result.data.municipalityCode)) {
                const canonical = GeoNormalizationService.canonicalizeMunicipalityName(munName);
                const resolvedCode = this.muniCache.get(state + '_' + canonical);
                if (resolvedCode) {
                  result.data.municipality_code = resolvedCode;
                }
              }
            }

            metrics.recordsValid++;
            batch.push(result);

            // Step 16: Persistência em Lotes
            if (batch.length >= BATCH_SIZE) {
              await this.insertBatch(sourceId, batch, metrics);
              batch = [];
              checkpoint = metrics.recordsRead;
              await this.saveProgress(job.id, checkpoint, metrics);
            }
          }
        } catch {
          metrics.recordsInvalid++;
        }
      }

      // Persiste lote remanescente
      if (batch.length > 0) {
        await this.insertBatch(sourceId, batch, metrics);
        checkpoint = metrics.recordsRead;
      }

      // Quality Gate Final: Não aceitar arquivos onde 100% dos dados falharam
      if (metrics.recordsRead > 0 && metrics.recordsValid === 0) {
        throw new Error("Quality Gate: Rejeição total - nenhum registro válido encontrado no arquivo (100% rejeitado).");
      }

      // Step 19: Registro de Sucesso do Job
      const finishedAt = new Date();
      const parserUsed = adapter ? adapter.constructor.name : 'UnknownAdapter';
      const parserVersion = (adapter && adapter.version) ? adapter.version : '1.0.0';
      const qualityStatus = (metrics.recordsInvalid > 0 || metrics.recordsWithInvalidCoordinates > 0 || metrics.recordsWithUnknownMunicipality > 0) ? 'WARNING' : 'PASSED';

      await db
        .update(dataImports)
        .set({
          status: 'COMPLETED',
          finishedAt,
          checkpoint: checkpoint.toString(),
          parserUsed,
          parserVersion,
          qualityStatus,
          recordsRead: metrics.recordsRead,
          recordsValid: metrics.recordsValid,
          recordsInvalid: metrics.recordsInvalid,
          recordsInserted: metrics.recordsInserted,
          recordsDuplicate: metrics.recordsDuplicate,
          recordsWithoutCoordinates: metrics.recordsWithoutCoordinates,
          recordsWithInvalidCoordinates: metrics.recordsWithInvalidCoordinates,
          recordsWithUnknownMunicipality: metrics.recordsWithUnknownMunicipality
        })
        .where(eq(dataImports.id, job.id));

      // Atualiza status da fonte correspondente
      try {
        await db.update(dataSources)
          .set({
            status: 'OPERATIONAL',
            lastSuccessfulImport: finishedAt,
            lastAttempt: finishedAt,
            errorMessage: null
          })
          .where(eq(dataSources.id, sourceId));
      } catch (e) {
        // Ignora caso SQLite não contenha todas as colunas
      }

      // Step 18: Invalidação de Cache
      analysisCache.clear();
      console.log(`[Worker ${this.workerId}] Job ${job.id} CONCLUÍDO com sucesso. ${metrics.recordsInserted} registros inseridos. Cache invalidado.`);

      return { success: true, metrics };

    } catch (error: any) {
      // Step 20: Registro de Falha do Job e Retry Controlado
      console.error(`[Worker ${this.workerId}] Job ${job.id} FALHOU:`, error.message);
      const failedAt = new Date();
      const currentAttempts = (job.attempts || 0) + 1;
      const MAX_RETRIES = 3;

      const isFatal = error.message.includes("Quality Gate:") ||
                      error.message.includes("fatal") ||
                      error.message.includes("Arquivo vazio");

      if (!isFatal && currentAttempts < MAX_RETRIES) {
        // Retry controlado: re-enfileira
        console.log(`[Worker ${this.workerId}] Re-agendando Job ${job.id} para retry (${currentAttempts}/${MAX_RETRIES})...`);
        await db
          .update(dataImports)
          .set({
            status: 'QUEUED',
            attempts: currentAttempts,
            lastError: error.message,
            failedAt,
            lockedAt: null,
            workerId: null,
            recordsRead: metrics.recordsRead,
            recordsValid: metrics.recordsValid,
            recordsInvalid: metrics.recordsInvalid,
            recordsInserted: metrics.recordsInserted,
            recordsDuplicate: metrics.recordsDuplicate
          })
          .where(eq(dataImports.id, job.id));
      } else {
        // Falha definitiva após esgotar retries ou falha fatal de Quality Gate
        await db
          .update(dataImports)
          .set({
            status: 'FAILED',
            qualityStatus: 'REJECTED',
            attempts: currentAttempts,
            lastError: error.message,
            failedAt,
            lockedAt: null,
            recordsRead: metrics.recordsRead,
            recordsValid: metrics.recordsValid,
            recordsInvalid: metrics.recordsInvalid,
            recordsInserted: metrics.recordsInserted,
            recordsDuplicate: metrics.recordsDuplicate
          })
          .where(eq(dataImports.id, job.id));

        try {
          await db.update(dataSources)
            .set({
              status: 'FAILING',
              errorMessage: error.message,
              lastAttempt: failedAt
            })
            .where(eq(dataSources.id, sourceId));
        } catch (e) {
          // Ignora caso SQLite não contenha todas as colunas
        }
      }

      return { success: false, metrics, error: error.message };
    }
  }

  private selectAdapter(sourceId: string): any {
    switch (sourceId) {
      case 'SSP-SP': return new SspSpAdapter();
      case 'SINESP': return new SinespAdapter();
      case 'ISP-RJ': return new IspRjAdapter();
      case 'SSP-MG':
      case 'SEJUSP-MG': return new SspMgAdapter();
      case 'SESP-PR': return new SespPrAdapter();
      case 'SSP-RS': return new SspRsAdapter();
      case 'SSP-SC': return new SspScAdapter();
      case 'SSP-BA': return new SspBaAdapter();
      case 'SDS-PE': return new SdsPeAdapter();
      case 'SSPDS-CE': return new SspdsCeAdapter();
      case 'SSP-DF': return new SspDfAdapter();
      case 'SSP-GO': return new SspGoAdapter();
      case 'SESP-AC': return new SespAcAdapter();
      case 'SSP-AL': return new SspAlAdapter();
      case 'SSP-AM': return new SspAmAdapter();
      case 'SEJUSP-AP': return new SejuspApAdapter();
      case 'SESP-ES': return new SespEsAdapter();
      case 'SSP-MA': return new SspMaAdapter();
      case 'SESP-MT': return new SespMtAdapter();
      case 'SEJUSP-MS': return new SejuspMsAdapter();
      case 'SEGUP-PA': return new SegupPaAdapter();
      case 'SEDS-PB': return new SedsPbAdapter();
      case 'SSP-PI': return new SspPiAdapter();
      case 'SESED-RN': return new SesedRnAdapter();
      case 'SESDEC-RO': return new SesdecRoAdapter();
      case 'SESP-RR': return new SespRrAdapter();
      case 'SSP-SE': return new SspSeAdapter();
      case 'SSP-TO': return new SspToAdapter();
      default: return null;
    }
  }

  private async insertBatch(sourceId: string, records: any[], metrics: IngestionMetrics) {
    if (records.length === 0) return;
    const target = records[0].target;
    
    if (target === 'occurrences') {
      const valuesToInsert = records.map(r => r.data).map(r => ({
        id: r.id || crypto.randomUUID(),
        sourceId: r.sourceId || r.source_id || sourceId,
        datasetId: r.datasetId || r.dataset_id || 'ocorrencias_criminais',
        sourceRecordId: r.sourceRecordId || r.source_record_id,
        country: r.country || 'BR',
        stateCode: r.stateCode || r.state_code || 'SP',
        stateName: r.stateName || r.state_name || 'São Paulo',
        municipalityCode: r.municipalityCode || r.municipality_code || null,
        municipalityName: r.municipalityName || r.municipality_name || null,
        category: r.category,
        subcategory: r.subcategory || null,
        sourceCategory: r.sourceCategory || r.source_category || null,
        occurredAt: r.occurredAt || r.occurred_at || null,
        year: r.year || (r.occurredAt ? new Date(r.occurredAt).getUTCFullYear() : new Date().getFullYear()),
        month: r.month || (r.occurredAt ? new Date(r.occurredAt).getUTCMonth() + 1 : 1),
        latitude: r.latitude || null,
        longitude: r.longitude || null,
        originalAddress: r.originalAddress || r.original_address || null,
        sourceData: r.sourceData || r.source_data || null,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      try {
        await db.insert(securityOccurrences).values(valuesToInsert).onConflictDoNothing();
        metrics.recordsInserted += valuesToInsert.length;
      } catch (e: any) {
        console.error(`[Worker ${this.workerId}] Falha no lote de occurrences:`, e.message);
        throw e;
      }

    } else if (target === 'indicators') {
      const valuesToInsert = records.map(r => r.data).map(r => ({
        id: r.id || crypto.randomUUID(),
        sourceId: r.sourceId || sourceId,
        datasetId: r.datasetId || 'indicadores_municipais',
        stateCode: r.stateCode || (sourceId === 'SSP-SP' ? 'SP' : 'BR'),
        municipalityCode: r.municipalityCode || "UNKNOWN",
        category: r.category,
        subcategory: r.subcategory || null,
        sourceCategory: r.sourceCategory || null,
        period: r.period,
        value: r.value,
        unit: r.unit || 'occurrences',
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      try {
        await db.insert(securityIndicators).values(valuesToInsert).onConflictDoUpdate({
          target: [
            securityIndicators.sourceId,
            securityIndicators.stateCode,
            securityIndicators.municipalityCode,
            securityIndicators.category,
            securityIndicators.subcategory,
            securityIndicators.period
          ],
          set: {
            value: sql`excluded.value`,
            updatedAt: new Date()
          }
        });
        metrics.recordsInserted += valuesToInsert.length;
      } catch (e: any) {
        console.error(`[Worker ${this.workerId}] Falha no lote de indicators:`, e.message);
        throw e;
      }
    }
  }

  private async saveProgress(jobId: string, checkpoint: number, metrics: IngestionMetrics) {
    await db
      .update(dataImports)
      .set({
        checkpoint: checkpoint.toString(),
        recordsRead: metrics.recordsRead,
        recordsValid: metrics.recordsValid,
        recordsInvalid: metrics.recordsInvalid,
        recordsInserted: metrics.recordsInserted,
        recordsWithoutCoordinates: metrics.recordsWithoutCoordinates,
        recordsWithInvalidCoordinates: metrics.recordsWithInvalidCoordinates,
        recordsWithUnknownMunicipality: metrics.recordsWithUnknownMunicipality,
        recordsDuplicate: metrics.recordsDuplicate
      })
      .where(eq(dataImports.id, jobId));
  }
}
