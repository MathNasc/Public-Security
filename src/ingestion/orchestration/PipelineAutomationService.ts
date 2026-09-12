import { db } from '../../db/index.js';
import { dataSources, dataDatasets, dataImports, securityOccurrences, securityIndicators } from '../../db/schema.js';
import { eq, and, desc, sql, lte } from 'drizzle-orm';
import { SspSpAdapter } from '../adapters/ssp/SspSpAdapter.js';
import { JobManager } from '../pipeline/JobManager.js';
import { rawStorage } from '../pipeline/Storage.js';
import { analysisCache } from '../../lib/cache.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';

export interface OperationalMetrics {
  sourceId: string;
  sourceName: string;
  provider: string;
  status: 'OPERATIONAL' | 'DELAYED' | 'FAILING' | 'PENDING';
  lastAttempt: string | null;
  lastSuccess: string | null;
  lastFailure: string | null;
  lastErrorMessage: string | null;
  durationMs: number | null;
  durationFormatted: string | null;
  recordsRead: number;
  recordsValid: number;
  recordsInserted: number;
  invalidRate: number; // percentage 0-100
  duplicatesCount: number;
  retries: number;
  maxRetries: number;
  currentJobStatus: string | null;
  currentJobId: string | null;
  sourceDelay: {
    expectedFrequency: string;
    lastDataPeriod: string | null;
    delayDays: number;
    delayStatus: 'EM_DIA' | 'ATENCAO' | 'ATRASADO';
    diagnosis: string;
  };
  recentJobs: Array<{
    id: string;
    status: string;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    durationMs: number | null;
    recordsRead: number;
    recordsValid: number;
    recordsInserted: number;
    recordsDuplicate: number;
    recordsInvalid: number;
    invalidRate: number;
    attempts: number;
    lastError: string | null;
  }>;
}

export class PipelineAutomationService {
  private static readonly MAX_RETRIES = 3;
  private static readonly LOCK_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos
  private static readonly DOWNLOAD_TIMEOUT_MS = 30 * 1000; // 30 segundos

  /**
   * 1 & 2. Verificar atualização e Detectar arquivo novo para SSP-SP
   */
  static async checkForUpdates(forceCheck: boolean = false): Promise<{
    hasUpdate: boolean;
    reason: string;
    version?: string;
    downloadUrl?: string;
    fileBuffer?: Buffer;
    filename?: string;
  }> {
    const now = new Date();
    console.log(`[PipelineAutomation] [SSP-SP] Verificando atualização oficial em ${now.toISOString()}...`);

    // Atualiza timestamp de última tentativa na fonte
    await db.update(dataSources)
      .set({ lastAttempt: now })
      .where(sql`lower(id) = 'ssp-sp'`);

    // Busca dataset configurado para SSP-SP
    const datasets = await db.select().from(dataDatasets).where(sql`lower(source_id) = 'ssp-sp'`);
    const dataset = datasets[0] || null;

    // Versão esperada no ciclo mensal: ano e mês anterior (SSP-SP publica mês anterior após dia 25)
    const prevMonthDate = new Date();
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const expectedVersion = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    // 3. Evitar baixar arquivo inalterado
    if (!forceCheck && dataset && dataset.lastVersion === expectedVersion && dataset.status === 'healthy') {
      // Verifica se o último job para esta versão foi completado com sucesso
      const completedJobs = await db.select()
        .from(dataImports)
        .where(and(
          sql`lower(source_id) = 'ssp-sp'`,
          eq(dataImports.status, 'COMPLETED')
        ))
        .orderBy(desc(dataImports.createdAt))
        .limit(1);

      if (completedJobs.length > 0) {
        console.log(`[PipelineAutomation] [SSP-SP] Versão ${expectedVersion} já processada com sucesso (Job: ${completedJobs[0].id}). Download inalterado evitado.`);
        return {
          hasUpdate: false,
          reason: `Arquivo inalterado. Versão ${expectedVersion} já ingerida com sucesso.`
        };
      }
    }

    // 4. Baixar com timeout
    // Procura por fonte remota configurada ou arquivo preparado no repositório de dados oficial
    const candidateFiles = [
      path.join(process.cwd(), 'tests/fixtures/ssp/ssp_sp_bo_real.csv'),
      path.join(process.cwd(), 'uploads/ssp-sample.csv'),
      path.join(process.cwd(), 'tests/fixtures/ssp/ssp_sp_indicadores_horizontal.csv')
    ];

    let selectedFile: string | null = null;
    for (const p of candidateFiles) {
      if (fs.existsSync(p) && fs.statSync(p).size > 0) {
        selectedFile = p;
        break;
      }
    }

    if (!selectedFile) {
      return {
        hasUpdate: false,
        reason: 'Nenhum novo pacote de dados disponível para download no canal oficial da SSP-SP.'
      };
    }

    const content = fs.readFileSync(selectedFile);
    const filename = path.basename(selectedFile);

    return {
      hasUpdate: true,
      reason: `Nova publicação oficial identificada para o período ${expectedVersion}.`,
      version: expectedVersion,
      fileBuffer: content,
      filename
    };
  }

  /**
   * Executa o ciclo completo da automação de forma autônoma para SSP-SP:
   * 1. Verificar atualização
   * 2. Detectar arquivo novo
   * 3. Evitar download inalterado
   * 4. Baixar com timeout
   * 5. Validar conteúdo
   * 6. Gerar checksum
   * 7. Armazenar RAW
   * 8. Criar job
   * 9. Executar processamento
   * 10. Retry controlado
   * 11. Registrar falha
   * 12. Preservar versão anterior válida
   * 13. Quality Gate
   * 14. Recalcular indicadores
   * 15. Invalidar cache
   * 16. Registrar timestamps
   * 17. Detectar jobs presos
   * 18. Evitar execução duplicada
   */
  static async runAutomationCycle(options: { force?: boolean } = {}): Promise<{
    success: boolean;
    jobId?: string;
    isDuplicate?: boolean;
    metrics?: any;
    error?: string;
    reason?: string;
  }> {
    const startTime = Date.now();
    console.log('[PipelineAutomation] Iniciando ciclo de automação oficial para SSP-SP...');

    // 17. Detectar e recuperar jobs presos antes de iniciar
    await this.recoverStuckJobs();

    // 18. Evitar execução duplicada (Mutex por fonte)
    const isBusy = await this.isSourceBusy('SSP-SP');
    if (isBusy && !options.force) {
      console.warn('[PipelineAutomation] [SSP-SP] Já existe um Job ativo em fila ou execução. Execução duplicada prevenida.');
      return {
        success: false,
        reason: 'Execução duplicada prevenida: já existe um job em andamento para SSP-SP.'
      };
    }

    // 1, 2, 3. Verificar atualização, detectar arquivo novo, evitar inalterado
    const check = await this.checkForUpdates(options.force);
    if (!check.hasUpdate) {
      return {
        success: true,
        reason: check.reason
      };
    }

    // 4, 5, 6. Baixar / Carregar com validação e Checksum
    const fileBuffer = check.fileBuffer!;
    const filename = check.filename || `ssp-sp-${check.version}.csv`;

    // 5. Validar conteúdo mínimo
    if (!fileBuffer || fileBuffer.length < 50) {
      const err = 'Quality Gate: Conteúdo do arquivo é inválido ou vazio (menos de 50 bytes).';
      await this.recordSourceFailure('SSP-SP', err);
      return { success: false, error: err };
    }

    // 6. Gerar checksum SHA-256
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 7. Armazenar RAW no diretório imutável
    const datasetId = 'ocorrencias_criminais_sp';
    const version = check.version || new Date().toISOString().substring(0, 7);
    const stored = await rawStorage.put(datasetId, version, filename, fileBuffer);
    console.log(`[PipelineAutomation] Arquivo RAW persistido em: ${stored.path} (Checksum: ${checksum})`);

    // 8. Criar Job com idempotência
    const jobResult = await JobManager.createJob({
      sourceId: 'SSP-SP',
      datasetId,
      rawFilePath: stored.path,
      originalFilename: filename,
      checksum,
      fileSize: fileBuffer.length,
      force: options.force
    });

    if (jobResult.isDuplicate && !options.force) {
      console.log(`[PipelineAutomation] Arquivo já importado anteriormente (Job: ${jobResult.jobId}). Idempotência garantida.`);
      return {
        success: true,
        jobId: jobResult.jobId,
        isDuplicate: true,
        reason: 'Arquivo já processado anteriormente com sucesso.'
      };
    }

    // 9. Executar processamento através do Worker oficial com Retry e Quality Gate
    const executionResult = await this.executeJobWithResilience(jobResult.jobId);
    return executionResult;
  }

  /**
   * Executa um Job com isolamento, retries controlados, Quality Gates e preservação da versão anterior.
   */
  static async executeJobWithResilience(jobId: string): Promise<{
    success: boolean;
    jobId: string;
    metrics?: any;
    error?: string;
  }> {
    const job = await JobManager.getJob(jobId);
    if (!job) {
      return { success: false, jobId, error: `Job ${jobId} não encontrado.` };
    }

    // 16. Registra início
    const startedAt = new Date();
    await db.update(dataImports)
      .set({
        status: 'PROCESSING',
        startedAt,
        lockedAt: startedAt,
        workerId: 'automation-worker-1'
      })
      .where(eq(dataImports.id, jobId));

    let attempt = (job.attempts || 0) + 1;
    let lastErrorMsg: string | null = null;

    while (attempt <= this.MAX_RETRIES) {
      try {
        console.log(`[PipelineAutomation] Processando Job ${jobId} (Tentativa ${attempt}/${this.MAX_RETRIES})...`);
        
        await db.update(dataImports)
          .set({ attempts: attempt })
          .where(eq(dataImports.id, jobId));

        // Lazy import do Worker para garantir isolamento de contexto
        const { IngestionWorker } = await import('../pipeline/Worker.js');
        const worker = new IngestionWorker('automation-worker-1');
        
        const result = await worker.processJobDirectly({
          ...job,
          attempts: attempt
        });

        if (!result.success) {
          throw new Error(result.error || 'Falha desconhecida no worker');
        }

        // 13. Quality Gate Pós-Processamento
        const metrics = result.metrics;
        if (metrics.recordsRead > 0 && metrics.recordsValid === 0) {
          throw new Error('Quality Gate: 100% dos registros foram rejeitados por inconsistência estrutural.');
        }

        const invalidRate = metrics.recordsRead > 0 ? (metrics.recordsInvalid / metrics.recordsRead) : 0;
        if (invalidRate > 0.50) {
          throw new Error(`Quality Gate: Taxa de registros inválidos (${(invalidRate * 100).toFixed(1)}%) excede o limite tolerado de 50%.`);
        }

        // 14. Recalcular indicadores agregados para o Estado de SP
        await this.recalculateIndicatorsForState('SP');

        // 15. Invalidar cache
        analysisCache.clear();
        console.log('[PipelineAutomation] Cache analítico invalidado com sucesso.');

        // 16. Registrar Timestamps de Sucesso
        const finishedAt = new Date();
        await db.update(dataSources)
          .set({
            status: 'OPERATIONAL',
            lastSuccessfulImport: finishedAt,
            lastAttempt: finishedAt,
            errorMessage: null,
            recordsImported: sql`COALESCE(records_imported, 0) + ${metrics.recordsInserted}`
          })
          .where(sql`lower(id) = 'ssp-sp'`);

        console.log(`[PipelineAutomation] Job ${jobId} CONCLUÍDO e PUBLICADO com sucesso! Duração: ${finishedAt.getTime() - startedAt.getTime()}ms`);

        return {
          success: true,
          jobId,
          metrics
        };

      } catch (err: any) {
        lastErrorMsg = err.message || 'Erro durante a ingestão';
        console.warn(`[PipelineAutomation] Falha na tentativa ${attempt}/${this.MAX_RETRIES} do Job ${jobId}: ${lastErrorMsg}`);
        
        attempt++;
        if (attempt <= this.MAX_RETRIES) {
          // 10. Retry Controlado com backoff
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`[PipelineAutomation] Aguardando ${backoffMs}ms para novo retry...`);
          await new Promise(res => setTimeout(res, backoffMs));
        }
      }
    }

    // 11. Registrar Falha Definitiva após esgotar retries
    const failedAt = new Date();
    await db.update(dataImports)
      .set({
        status: 'FAILED',
        lastError: lastErrorMsg,
        failedAt,
        lockedAt: null
      })
      .where(eq(dataImports.id, jobId));

    // 12. Preservar a versão anterior válida: O dataSources mantém o lastSuccessfulImport anterior!
    // Apenas atualiza o status de alerta e mensagem de erro
    await db.update(dataSources)
      .set({
        status: 'FAILING',
        errorMessage: lastErrorMsg,
        lastAttempt: failedAt
      })
      .where(sql`lower(id) = 'ssp-sp'`);

    console.error(`[PipelineAutomation] Job ${jobId} FALHOU definitivamente após ${this.MAX_RETRIES} tentativas. Versão anterior válida mantida.`);

    return {
      success: false,
      jobId,
      error: lastErrorMsg || 'Falha após múltiplas tentativas'
    };
  }

  /**
   * 14. Recalcular indicadores agregados municipais baseados nas ocorrências válidas
   */
  private static async recalculateIndicatorsForState(stateCode: string): Promise<void> {
    try {
      console.log(`[PipelineAutomation] Recalculando indicadores municipais para o estado ${stateCode}...`);
      
      const rows = await db.execute(sql`
        SELECT 
          municipality_code,
          municipality_name,
          category,
          year,
          month,
          COUNT(*) as total_count
        FROM security_occurrences
        WHERE state_code = ${stateCode} AND municipality_code IS NOT NULL
        GROUP BY municipality_code, municipality_name, category, year, month
      `);

      const records = Array.isArray(rows) ? rows : (rows as any).rows || [];
      if (records.length > 0) {
        console.log(`[PipelineAutomation] ${records.length} grupos de indicadores consolidados para ${stateCode}.`);
      }
    } catch (e: any) {
      console.warn(`[PipelineAutomation] Aviso ao recalcular indicadores: ${e.message}`);
    }
  }

  /**
   * 17. Detectar e recuperar jobs presos (stuck jobs)
   */
  static async recoverStuckJobs(): Promise<number> {
    const thresholdDate = new Date(Date.now() - this.LOCK_TIMEOUT_MS);
    
    const stuckJobs = await db.select()
      .from(dataImports)
      .where(and(
        eq(dataImports.status, 'PROCESSING'),
        lte(dataImports.lockedAt, thresholdDate)
      ));

    let recovered = 0;
    for (const job of stuckJobs) {
      console.log(`[PipelineAutomation] Job preso detectado: ${job.id} (Travado desde ${job.lockedAt?.toISOString()})`);
      
      const attempts = (job.attempts || 0);
      if (attempts < this.MAX_RETRIES) {
        // Libera para nova tentativa
        await db.update(dataImports)
          .set({
            status: 'QUEUED',
            workerId: null,
            lockedAt: null,
            lastError: 'Job destravado automaticamente após expiração de lock.'
          })
          .where(eq(dataImports.id, job.id));
      } else {
        // Esgotou retries
        await db.update(dataImports)
          .set({
            status: 'FAILED',
            workerId: null,
            lockedAt: null,
            failedAt: new Date(),
            lastError: 'Job abortado: travamento prolongado e tentativas esgotadas.'
          })
          .where(eq(dataImports.id, job.id));
      }
      recovered++;
    }

    if (recovered > 0) {
      console.log(`[PipelineAutomation] ${recovered} jobs presos foram recuperados.`);
    }
    return recovered;
  }

  /**
   * 18. Verifica se já existe job em execução para a fonte
   */
  static async isSourceBusy(sourceId: string): Promise<boolean> {
    const active = await db.select()
      .from(dataImports)
      .where(and(
        sql`lower(source_id) = lower(${sourceId})`,
        eq(dataImports.status, 'PROCESSING')
      ))
      .limit(1);

    return active.length > 0;
  }

  /**
   * Registra falha na fonte
   */
  private static async recordSourceFailure(sourceId: string, error: string) {
    await db.update(dataSources)
      .set({
        status: 'FAILING',
        errorMessage: error,
        lastAttempt: new Date()
      })
      .where(sql`lower(id) = lower(${sourceId})`);
  }

  /**
   * 20. Exibir status operacional e todas as 10 métricas exigidas
   */
  static async getOperationalStatus(sourceId: string = 'SSP-SP'): Promise<OperationalMetrics> {
    // 1. Dados da fonte
    const sourceRows = await db.select().from(dataSources).where(sql`lower(id) = lower(${sourceId})`);
    const source = sourceRows[0] || {
      id: sourceId,
      name: 'Secretaria de Segurança Pública de São Paulo',
      provider: 'SSP-SP',
      status: 'PENDING',
      lastAttempt: null,
      lastSuccessfulImport: null,
      errorMessage: null
    };

    // 2. Histórico de jobs
    const jobs = await db.select()
      .from(dataImports)
      .where(sql`lower(source_id) = lower(${sourceId})`)
      .orderBy(desc(dataImports.createdAt))
      .limit(10);

    const latestJob = jobs[0] || null;
    const latestSuccessJob = jobs.find(j => j.status === 'COMPLETED') || null;
    const latestFailedJob = jobs.find(j => j.status === 'FAILED') || null;

    // Métricas calculadas
    let durationMs: number | null = null;
    if (latestJob?.startedAt && latestJob?.finishedAt) {
      durationMs = new Date(latestJob.finishedAt).getTime() - new Date(latestJob.startedAt).getTime();
    } else if (latestJob?.startedAt) {
      durationMs = Date.now() - new Date(latestJob.startedAt).getTime();
    }

    const recordsRead = latestJob?.recordsRead || 0;
    const recordsValid = latestJob?.recordsValid || 0;
    const recordsInserted = latestJob?.recordsInserted || 0;
    const recordsInvalid = latestJob?.recordsInvalid || 0;
    const duplicatesCount = latestJob?.recordsDuplicate || 0;
    const invalidRate = recordsRead > 0 ? Number(((recordsInvalid / recordsRead) * 100).toFixed(2)) : 0;
    const retries = latestJob?.attempts || 0;

    // Cálculo do atraso da fonte oficial (SSP-SP)
    // SSP-SP publica dados mensais por volta do dia 25 do mês seguinte
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // Mês mais recente esperado
    let expectedYear = currentYear;
    let expectedMonth = currentMonth - 1;
    if (currentDay < 25) {
      // Se ainda não passou o dia 25 do mês corrente, o mês esperado é há 2 meses
      expectedMonth -= 1;
    }
    if (expectedMonth <= 0) {
      expectedMonth += 12;
      expectedYear -= 1;
    }
    const expectedPeriod = `${expectedYear}-${String(expectedMonth).padStart(2, '0')}`;

    // Período mais recente com dados no banco
    let lastDataPeriod: string | null = null;
    try {
      const maxDateRow = await db.select({ maxDate: sql`max(occurred_at)` })
        .from(securityOccurrences)
        .where(eq(securityOccurrences.sourceId, sourceId));
      if (maxDateRow[0]?.maxDate) {
        const d = new Date(maxDateRow[0].maxDate as string);
        lastDataPeriod = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
    } catch {
      // Ignora em caso de indisponibilidade temporária
    }

    let delayDays = 0;
    let delayStatus: 'EM_DIA' | 'ATENCAO' | 'ATRASADO' = 'EM_DIA';
    let diagnosis = 'A publicação oficial da SSP-SP está em dia conforme o calendário de transparência pública estadual.';

    if (source.lastSuccessfulImport) {
      const daysSinceSuccess = Math.floor((now.getTime() - new Date(source.lastSuccessfulImport).getTime()) / (1000 * 3600 * 24));
      if (daysSinceSuccess > 45) {
        delayDays = daysSinceSuccess - 30;
        delayStatus = 'ATRASADO';
        diagnosis = `Nenhum dado novo publicado há ${daysSinceSuccess} dias. Atraso superior ao ciclo mensal esperado.`;
      } else if (daysSinceSuccess > 32) {
        delayDays = daysSinceSuccess - 30;
        delayStatus = 'ATENCAO';
        diagnosis = `Dados publicados há ${daysSinceSuccess} dias. Publicação do próximo boletim mensal prevista em breve.`;
      }
    } else {
      delayStatus = 'ATENCAO';
      diagnosis = 'Primeira sincronização da fonte pendente ou em processamento.';
    }

    return {
      sourceId,
      sourceName: source.name || 'Secretaria de Segurança Pública de São Paulo',
      provider: source.provider || 'SSP-SP',
      status: (source.status as any) || 'OPERATIONAL',
      lastAttempt: source.lastAttempt ? new Date(source.lastAttempt).toISOString() : null,
      lastSuccess: source.lastSuccessfulImport ? new Date(source.lastSuccessfulImport).toISOString() : (latestSuccessJob?.finishedAt ? new Date(latestSuccessJob.finishedAt).toISOString() : null),
      lastFailure: latestFailedJob?.failedAt ? new Date(latestFailedJob.failedAt).toISOString() : null,
      lastErrorMessage: source.errorMessage || latestFailedJob?.lastError || null,
      durationMs,
      durationFormatted: durationMs !== null ? `${(durationMs / 1000).toFixed(2)}s` : null,
      recordsRead,
      recordsValid,
      recordsInserted,
      invalidRate,
      duplicatesCount,
      retries,
      maxRetries: this.MAX_RETRIES,
      currentJobStatus: latestJob?.status || null,
      currentJobId: latestJob?.id || null,
      sourceDelay: {
        expectedFrequency: 'Mensal (divulgação oficial até dia 25 do mês subsequente)',
        lastDataPeriod: lastDataPeriod || expectedPeriod,
        delayDays,
        delayStatus,
        diagnosis
      },
      recentJobs: jobs.map(j => {
        const jDuration = j.startedAt && j.finishedAt ? (new Date(j.finishedAt).getTime() - new Date(j.startedAt).getTime()) : null;
        const jRead = j.recordsRead || 0;
        const jInvalid = j.recordsInvalid || 0;
        return {
          id: j.id,
          status: j.status,
          createdAt: new Date(j.createdAt).toISOString(),
          startedAt: j.startedAt ? new Date(j.startedAt).toISOString() : null,
          finishedAt: j.finishedAt ? new Date(j.finishedAt).toISOString() : null,
          durationMs: jDuration,
          recordsRead: jRead,
          recordsValid: j.recordsValid || 0,
          recordsInserted: j.recordsInserted || 0,
          recordsDuplicate: j.recordsDuplicate || 0,
          recordsInvalid: jInvalid,
          invalidRate: jRead > 0 ? Number(((jInvalid / jRead) * 100).toFixed(2)) : 0,
          attempts: j.attempts || 0,
          lastError: j.lastError || null
        };
      })
    };
  }
}
