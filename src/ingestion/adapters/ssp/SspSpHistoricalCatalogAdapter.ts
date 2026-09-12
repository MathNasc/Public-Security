/**
 * SspSpHistoricalCatalogAdapter.ts
 * Adapter completo de alta performance para o Catálogo Histórico Oficial da SSP-SP (SP Dados).
 * Suporta descoberta dinâmica de 2022 até o ano corrente, bases MDIP (2013-2026),
 * séries históricas legadas e reconciliação estatística governamental.
 */
import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord, SchemaValidationResult } from '../BaseAdapter.js';
import { normalizeLegacyCategory } from '../../../services/Taxonomy.js';
import { SspCatalogService, OfficialDatasetMeta } from './SspCatalog.js';
import { SspIdentityService } from './SspIdentity.js';
import { StreamingXlsxParser } from '../../parsers/StreamingXlsxParser.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

export interface SspDownloadOptions {
  year?: number;
  datasetId?: string;
}

export class SspSpHistoricalCatalogAdapter extends BaseAdapter {
  private targetYear: number;
  private targetDataset?: OfficialDatasetMeta;

  constructor(options?: SspDownloadOptions) {
    super();
    this.targetYear = options?.year || new Date().getFullYear();
    if (options?.datasetId) {
      this.targetDataset = SspCatalogService.getDatasetById(options.datasetId);
    }
  }

  metadata(): AdapterMetadata {
    return {
      name: "Secretaria de Segurança Pública de São Paulo - Catálogo Histórico SP Dados",
      agency: "SSP-SP",
      frequency: "Mensal / Anual Consolidado",
      coverage: "SP (645 municípios)",
      limitations: [
        "Série moderna padronizada (SPDadosCriminais) disponível a partir de 2022 com códigos IBGE e competência territorial",
        "Séries históricas anteriores a 2023 possuem formatos legados com agrupamentos distintos por delito",
        "Base MDIP cobre 2013-2026 com granularidade por vítima fatal de intervenção policial"
      ]
    };
  }

  identifyVersion(): string {
    const currentMonth = new Date().getMonth() + 1;
    return `${this.targetYear}-${String(currentMonth).padStart(2, '0')}`;
  }

  /**
   * Descoberta dinâmica de catálogo e endpoints da SSP-SP.
   */
  async discover(): Promise<DiscoveryResult> {
    // Se um dataset específico foi definido
    if (this.targetDataset) {
      return {
        source: "SSP-SP",
        dataset: this.targetDataset.id,
        url: this.targetDataset.officialUrl,
        version: `${this.targetYear}-01`,
        checksum: crypto.createHash('sha256').update(this.targetDataset.officialUrl).digest('hex')
      };
    }

    // Padrão: Microdados anuais SPDadosCriminais_YYYY.xlsx
    const officialUrl = `https://www.ssp.sp.gov.br/assets/estatistica/transparencia/spDados/SPDadosCriminais_${this.targetYear}.xlsx`;
    const version = `${this.targetYear}-01`;

    return {
      source: "SSP-SP",
      dataset: `SPDadosCriminais_${this.targetYear}`,
      url: officialUrl,
      version,
      checksum: crypto.createHash('sha256').update(`ssp-sp-${this.targetYear}`).digest('hex')
    };
  }

  /**
   * Baixa o arquivo oficial da SSP-SP e armazena em RAW com metadados imutáveis.
   */
  async download(destinationPath: string): Promise<string> {
    const discovery = await this.discover();
    console.log(`[SspHistoricalAdapter] Baixando arquivo oficial: ${discovery.url}`);

    const dir = path.dirname(destinationPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const response = await axios.get(discovery.url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PublicSecurity-Auditor/1.0',
        'Accept': '*/*'
      },
      timeout: 120000 // 2 minutos de timeout para arquivos grandes
    });

    const buffer = Buffer.from(response.data);
    fs.writeFileSync(destinationPath, buffer);

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const metaPath = `${destinationPath}.meta.json`;
    const meta = {
      sourceUrl: discovery.url,
      downloadedAt: new Date().toISOString(),
      bytes: buffer.length,
      sha256: hash,
      httpStatus: response.status,
      etag: response.headers['etag'] || null,
      lastModified: response.headers['last-modified'] || null
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    console.log(`[SspHistoricalAdapter] Download concluído com sucesso: ${buffer.length} bytes (SHA256: ${hash.substring(0, 12)}...)`);
    return destinationPath;
  }

  /**
   * Validação de Schema oficial para SPDadosCriminais e MDIP.
   */
  validateSchema(headers: string[]): SchemaValidationResult {
    const normalized = headers.map(h => h.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

    // 1. Schema SPDadosCriminais (Microdados modernos)
    const isSpDados = (
      normalized.includes('NUM_BO') &&
      normalized.includes('ANO_BO') &&
      (normalized.includes('NATUREZA_APURADA') || normalized.includes('RUBRICA'))
    );

    if (isSpDados) {
      return {
        valid: true,
        format: 'occurrences',
        detectedColumns: normalized
      };
    }

    // 2. Schema MDIP (Morte Decorrente de Intervenção Policial)
    const isMdip = (
      normalized.includes('N_DO_BO') || normalized.includes('NUM_BO') ||
      normalized.includes('CORPORACAO') || normalized.includes('SITUACAO')
    );

    if (isMdip) {
      return {
        valid: true,
        format: 'occurrences',
        detectedColumns: normalized
      };
    }

    // 3. Schema de Indicadores Agregados
    const isIndicator = normalized.includes('MUNICIPIO') && (normalized.includes('DELITO') || normalized.includes('JANEIRO'));
    if (isIndicator) {
      return {
        valid: true,
        format: 'indicators',
        detectedColumns: normalized
      };
    }

    return {
      valid: false,
      error: 'Schema não reconhecido para o catálogo SSP-SP.',
      detectedColumns: normalized
    };
  }

  /**
   * Parser semântico canônico de linha de microdados da SSP-SP.
   */
  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    if (!row) return null;

    // Detecta se é linha de microdados SPDadosCriminais
    const anoBoRaw = row.ANO_BO || row.ANO_ESTATISTICA || this.targetYear;
    const numBoRaw = row.NUM_BO || row.N_DO_BO || row.NUMERO_BO;
    const natApuradaRaw = row.NATUREZA_APURADA || row.DELITO || row.DESCR_CONDUTA || 'OUTROS';
    const rubricaRaw = row.RUBRICA || '';
    const dpCircunscricao = row.NOME_DELEGACIA_CIRCUNSCRICAO || row.NOME_DELEGACIA || 'NAO_INFORMADA';

    if (!numBoRaw && !row.CIDADE && !row.MUNICIPIO) {
      return null;
    }

    // Normalização Canônica da Categoria de Crime
    const sourceCategory = String(natApuradaRaw).trim();
    const normalizedCategory = normalizeLegacyCategory(sourceCategory);

    // Identidade Canônica e Deduplicação
    const identity = SspIdentityService.buildIdentity(
      anoBoRaw,
      numBoRaw,
      dpCircunscricao,
      sourceCategory,
      rubricaRaw
    );

    // Resolução de datas
    const dateParsed = SspIdentityService.parseExcelOrDateString(row.DATA_OCORRENCIA_BO || row.DATA_FATO || row.DATAHORA_REGISTRO_BO);
    const anoEstatistica = parseInt(String(row.ANO_ESTATISTICA || identity.anoBo), 10) || identity.anoBo;
    const mesEstatistica = parseInt(String(row.MES_ESTATISTICA || dateParsed.month || 1), 10) || 1;

    // Município e IBGE
    const codIbge = row.COD_IBGE ? String(row.COD_IBGE).trim() : null;
    const municipioTerritorial = row.NOME_MUNICIPIO_CIRCUNSCRICAO || row.CIDADE || row.MUNICIPIO || 'São Paulo';
    const municipioRegistro = row.NOME_MUNICIPIO || municipioTerritorial;

    // Coordenadas geográficas
    const coords = SspIdentityService.parseCoordinates(row.LATITUDE, row.LONGITUDE);

    // Dataset type (Microdados vs MDIP)
    const isMdip = !!(row.CORPORACAO || row.SITUACAO || sourceCategory.toUpperCase().includes('INTERVENCAO POLICIAL'));
    const datasetType = isMdip ? 'MDIP' : 'MICRODADOS_CRIMINAIS';

    const occurrenceRecord: ParsedRecord = {
      target: 'occurrences',
      data: {
        id: identity.sourceRecordId,
        sourceId: 'SSP-SP',
        datasetType,
        sourceChecksum: identity.sourceRecordId,
        incidentHash: identity.sourceRecordId,
        numBo: identity.numBo,
        anoBo: identity.anoBo,
        anoEstatistica,
        mesEstatistica,
        dataOcorrencia: dateParsed.date,
        horaOcorrencia: row.HORA_OCORRENCIA_BO ? String(row.HORA_OCORRENCIA_BO).trim() : null,
        municipioRegistro,
        municipioTerritorial,
        municipality: municipioTerritorial,
        codIbge,
        municipalityCode: codIbge || '3550308',
        stateCode: 'SP',
        bairro: row.BAIRRO ? String(row.BAIRRO).trim() : null,
        logradouro: row.LOGRADOURO ? String(row.LOGRADOURO).trim() : null,
        numeroLogradouro: row.NUMERO_LOGRADOURO ? String(row.NUMERO_LOGRADOURO).trim() : null,
        latitude: coords.latitude,
        longitude: coords.longitude,
        isGeocoded: coords.isValid,
        category: normalizedCategory,
        subcategory: rubricaRaw ? String(rubricaRaw).trim() : null,
        sourceCategory,
        naturezaApurada: sourceCategory,
        rubrica: rubricaRaw,
        descricaoConduta: row.DESCR_CONDUTA || null,
        delegacia: row.NOME_DELEGACIA || null,
        delegaciaCircunscricao: dpCircunscricao,
        seccional: row.NOME_DEPARTAMENTO_CIRCUNSCRICAO || row.DEPARTAMENTO || null,
        departamento: row.NOME_DEPARTAMENTO || null,
        year: anoEstatistica,
        month: mesEstatistica,
        sourceData: row
      }
    };

    return occurrenceRecord;
  }
}
