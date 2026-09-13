/**
 * SspSpProvider.ts
 * Implementação formal do State Provider para o Estado de São Paulo (SSP-SP).
 * Encapsula capacidades, catálogo e integração da Secretaria de Segurança Pública de São Paulo.
 */

import { 
  StateProvider, 
  ProviderCapabilities, 
  StateDataset, 
  StateDefinition,
  CanonicalOccurrence, 
  CanonicalIndicator, 
  TaxonomyMapping, 
  SourceProvenance 
} from '../../core/contracts/index.js';
import { SspSpAdapter } from '../../adapters/ssp/SspSpAdapter.js';
import { SSP_SP_OFFICIAL_CATALOG } from '../../adapters/ssp/SspCatalog.js';
import { SspIdentityService } from '../../adapters/ssp/SspIdentity.js';
import { SspReconciliationService } from '../../adapters/ssp/SspReconciliationService.js';
import { StateRegistry } from '../../core/registry/StateRegistry.js';

export class SspSpProvider implements StateProvider {
  public readonly stateCode = 'SP';
  public readonly ibgeStateCode = 35;
  public readonly stateName = 'São Paulo';
  public readonly providerName = 'Secretaria de Segurança Pública de São Paulo - SSP-SP';
  public readonly version = '2026.01';

  public readonly capabilities: ProviderCapabilities = {
    occurrences: true,
    indicators: true,
    coordinates: true,
    historicalData: true,
    monthlyData: true,
    automatedDownload: true
  };

  private adapter: SspSpAdapter;

  constructor() {
    this.adapter = new SspSpAdapter();
  }

  public getStateDefinition(): StateDefinition {
    return {
      code: 'SP',
      ibgeCode: 35,
      name: 'São Paulo',
      agency: 'Secretaria de Segurança Pública de São Paulo - SSP-SP',
      enabled: true,
      primaryProviderId: 'SSP-SP'
    };
  }

  /**
   * Validação de qualidade de dados para São Paulo
   */
  public async validateQuality(data: any[]) {
    const total = data.length;
    const valid = data.filter(d => d.stateCode === 'SP' || d.state_code === 'SP').length;
    return {
      stateCode: 'SP',
      totalRecords: total,
      validRecords: valid,
      invalidRecords: total - valid,
      geocodedRecords: data.filter(d => d.latitude && d.longitude).length,
      qualityScore: total > 0 ? Math.round((valid / total) * 100) : 100,
      passedQualityGate: total === 0 || (valid / total) >= 0.95
    };
  }

  /**
   * Retorna os datasets oficiais disponíveis para o Estado de São Paulo
   */
  public getDatasets(): StateDataset[] {
    return SSP_SP_OFFICIAL_CATALOG.map(d => ({
      id: d.id,
      stateCode: 'SP',
      name: d.name,
      datasetType: d.datasetType === 'MICRODADOS_CRIMINAIS' ? 'microdata_bo' : 'monthly_indicators',
      enabled: d.isActive,
      supportsOccurrences: d.granularity === 'ocorrencia_bo',
      supportsIndicators: d.granularity === 'mensal_municipio' || d.granularity === 'ocorrencia_bo',
      temporalCoverage: `${d.periodStart} a ${d.periodEnd}`,
      geographicCoverage: 'Estado de São Paulo (645 municípios)',
      fileFormat: d.format === 'xlsx' ? 'xlsx' : 'csv',
      officialUrl: d.officialUrl
    }));
  }

  /**
   * Descoberta da publicação mais recente da SSP-SP
   */
  public async discover(): Promise<{
    source: string;
    version: string;
    url?: string;
    period?: string;
    checksum?: string;
  }> {
    const res = await this.adapter.discover();
    return {
      source: 'SSP-SP',
      version: res.version,
      url: res.url,
      checksum: res.checksum
    };
  }

  /**
   * Gera a chave única de um registro bruto para garantia de idempotência
   */
  public getNaturalKey(record: any): string {
    const anoBo = record.ANO_BO || record.anoBo || record.year || record.Ano || 0;
    const numBo = record.NUM_BO || record.numBo || record.source_record_id || record.Total || '';
    const delegacia = record.NOME_DELEGACIA_CIRCUNSCRICAO || record.delegacia || record.DELEGACIA_NOME || '';
    const natureza = record.NATUREZA_APURADA || record.natureza || record.Natureza || '';
    const rubrica = record.RUBRICA || record.rubrica || '';
    return SspIdentityService.buildIdentity(anoBo, numBo, delegacia, natureza, rubrica).sourceRecordId;
  }

  /**
   * Normaliza um registro bruto diretamente para a entidade canônica
   */
  public normalize(record: any): CanonicalOccurrence {
    const rawParsed = this.adapter.parseRow(record);
    const parsed = Array.isArray(rawParsed) ? rawParsed[0] : rawParsed;
    const d = parsed?.data || {};
    const category = d.category || 'theft';
    const subcategory = d.subcategory || record.Natureza || record.natureza || null;

    return {
      sourceId: 'SSP-SP',
      stateCode: 'SP',
      municipalityCode: d.municipalityCode || d.municipality_code || '3550308',
      municipalityName: d.municipalityName || d.municipality_name || record.Municipio || 'São Paulo',
      occurredAt: d.occurredAt ? new Date(d.occurredAt) : new Date(),
      referencePeriod: `${d.year || record.Ano || 2026}-${String(d.month || record.Mes || 1).padStart(2, '0')}`,
      category,
      subcategory,
      sourceCategory: d.sourceCategory || record.Natureza || null,
      latitude: d.latitude !== undefined && d.latitude !== null ? Number(d.latitude) : (record.LATITUDE ? Number(record.LATITUDE) : null),
      longitude: d.longitude !== undefined && d.longitude !== null ? Number(d.longitude) : (record.LONGITUDE ? Number(record.LONGITUDE) : null),
      locationPrecision: (d.latitude || record.LATITUDE) ? 'exact' : 'none',
      isSyntheticPoint: false,
      sourceRecordId: d.sourceRecordId || record.NUM_BO || null,
      incidentHash: d.incidentHash || this.getNaturalKey(record),
      originalAddress: d.originalAddress || record.LOGRADOURO || null,
      sourceData: d.sourceData || record
    };
  }

  /**
   * Normaliza registro de BO para o contrato canônico de Ocorrência
   */
  public normalizeOccurrence(record: any): CanonicalOccurrence | null {
    const parsed = this.adapter.parseRow(record);
    if (!parsed) return null;

    const items = Array.isArray(parsed) ? parsed : [parsed];
    const occItem = items.find(i => i.target === 'occurrences');
    if (!occItem || !occItem.data) return null;

    const d = occItem.data;
    return {
      sourceId: 'SSP-SP',
      stateCode: 'SP',
      municipalityCode: d.municipalityCode || d.municipality_code || null,
      municipalityName: d.municipalityName || d.municipality_name || null,
      occurredAt: d.occurredAt ? new Date(d.occurredAt) : null,
      category: d.category,
      subcategory: d.subcategory || null,
      sourceCategory: d.sourceCategory || d.source_category || null,
      latitude: d.latitude !== undefined && d.latitude !== null ? Number(d.latitude) : null,
      longitude: d.longitude !== undefined && d.longitude !== null ? Number(d.longitude) : null,
      locationPrecision: d.locationPrecision || (d.latitude ? 'exact' : 'none'),
      isSyntheticPoint: false,
      sourceRecordId: d.sourceRecordId || null,
      incidentHash: d.incidentHash || this.getNaturalKey(record),
      originalAddress: d.originalAddress || null,
      sourceData: d.sourceData || null
    };
  }

  /**
   * Normaliza linha da tabela estatística oficial para o contrato canônico de Indicador
   */
  public normalizeIndicator(record: any): CanonicalIndicator | CanonicalIndicator[] | null {
    const parsed = this.adapter.parseRow(record);
    if (!parsed) return null;

    const items = Array.isArray(parsed) ? parsed : [parsed];
    const indItems = items.filter(i => i.target === 'indicators');
    if (indItems.length === 0) return null;

    const result: CanonicalIndicator[] = indItems.map(item => {
      const d = item.data;
      return {
        sourceId: 'SSP-SP',
        stateCode: 'SP',
        municipalityCode: d.municipalityCode || d.municipality_code || '',
        category: d.category,
        subcategory: d.subcategory || null,
        period: d.period,
        value: Number(d.value) || 0,
        unit: 'count',
        granularity: 'municipality',
        sourceCategory: d.sourceCategory || null,
        populationReference: d.populationReference || null
      };
    });

    return result.length === 1 ? result[0] : result;
  }

  /**
   * Retorna os mapeamentos taxonômicos canônicos de SP
   */
  public getTaxonomyMappings(): TaxonomyMapping[] {
    return [
      {
        stateCode: 'SP',
        sourceId: 'SSP-SP',
        sourceCategory: 'HOMICÍDIO DOLOSO (EXCLUI FEMINICÍDIO)',
        canonicalCategory: 'homicide',
        canonicalSubcategory: 'intentional_homicide',
        mappingStatus: 'mapped'
      },
      {
        stateCode: 'SP',
        sourceId: 'SSP-SP',
        sourceCategory: 'LATROCÍNIO',
        canonicalCategory: 'robbery',
        canonicalSubcategory: 'robbery_resulting_in_death',
        mappingStatus: 'mapped'
      },
      {
        stateCode: 'SP',
        sourceId: 'SSP-SP',
        sourceCategory: 'ROUBO - OUTROS',
        canonicalCategory: 'robbery',
        canonicalSubcategory: 'other_robbery',
        mappingStatus: 'mapped'
      },
      {
        stateCode: 'SP',
        sourceId: 'SSP-SP',
        sourceCategory: 'ROUBO DE VEÍCULO',
        canonicalCategory: 'robbery',
        canonicalSubcategory: 'vehicle_robbery',
        mappingStatus: 'mapped'
      },
      {
        stateCode: 'SP',
        sourceId: 'SSP-SP',
        sourceCategory: 'FURTO - OUTROS',
        canonicalCategory: 'theft',
        canonicalSubcategory: 'other_theft',
        mappingStatus: 'mapped'
      },
      {
        stateCode: 'SP',
        sourceId: 'SSP-SP',
        sourceCategory: 'FURTO DE VEÍCULO',
        canonicalCategory: 'theft',
        canonicalSubcategory: 'vehicle_theft',
        mappingStatus: 'mapped'
      },
      {
        stateCode: 'SP',
        sourceId: 'SSP-SP',
        sourceCategory: 'ESTUPRO',
        canonicalCategory: 'rape',
        canonicalSubcategory: 'rape_general',
        mappingStatus: 'mapped'
      }
    ];
  }

  /**
   * Reconciliação oficial SSP-SP
   */
  public async reconcile(periodOrOccurrences: string | number | CanonicalOccurrence[], maybeIndicators?: CanonicalIndicator[]): Promise<{
    period: string;
    passed: boolean;
    differences: Array<{
      category: string;
      occurrencesCount: number;
      indicatorsCount: number;
      delta: number;
    }>;
    stateCode?: string;
    occurrenceCount?: number;
    indicatorAggregatedSum?: number;
    discrepancyAbsolute?: number;
    discrepancyPercentage?: number;
    status?: string;
    reconciled?: boolean;
    discrepanciesCount?: number;
    timestamp?: Date;
  }> {
    if (Array.isArray(periodOrOccurrences)) {
      const occs = periodOrOccurrences;
      const inds = maybeIndicators || [];
      const occTotal = occs.length;
      const indTotal = inds.reduce((acc, i) => acc + (i.value || 0), 0);
      const delta = Math.abs(occTotal - indTotal);
      return {
        stateCode: 'SP',
        period: '2026',
        occurrenceCount: occTotal,
        indicatorAggregatedSum: indTotal,
        discrepancyAbsolute: delta,
        discrepancyPercentage: occTotal > 0 ? (delta / occTotal) * 100 : 0,
        status: delta === 0 ? 'MATCH_EXACT' : (delta / (occTotal || 1) < 0.05 ? 'MATCH_APPROXIMATE' : 'DISCREPANCY_DETECTED'),
        reconciled: delta / (occTotal || 1) < 0.05,
        passed: delta / (occTotal || 1) < 0.05,
        differences: delta > 0 ? [{ category: 'total', occurrencesCount: occTotal, indicatorsCount: indTotal, delta }] : [],
        timestamp: new Date()
      };
    }

    const periodStr = String(periodOrOccurrences || new Date().getFullYear());
    const year = parseInt(periodStr.split('-')[0], 10) || new Date().getFullYear();
    const res = await SspReconciliationService.reconcileYear(year);
    return {
      stateCode: 'SP',
      period: String(res.ano),
      reconciled: res.summary.congruenciaGeral !== 'DIVERGENCIA_METODOLOGICA',
      passed: res.summary.congruenciaGeral !== 'DIVERGENCIA_METODOLOGICA',
      discrepanciesCount: res.comparisons.filter(c => c.deltaAbsoluto > 0).length,
      differences: res.comparisons.map(d => ({
        category: d.category,
        occurrencesCount: d.microdadosTotal,
        indicatorsCount: d.officialTotal,
        delta: d.deltaAbsoluto
      }))
    };
  }

  /**
   * Proveniência oficial
   */
  public getProvenance(datasetId: string): SourceProvenance {
    return {
      sourceId: 'SSP-SP',
      stateCode: 'SP',
      providerName: this.providerName,
      datasetType: 'microdata_bo',
      sourceUrl: 'https://www.ssp.sp.gov.br/transparenciassp/',
      isOfficialPublication: true,
      evidenceLevel: 'E6'
    };
  }
}

// Auto-registro oficial do Provider de São Paulo no StateRegistry
StateRegistry.register(new SspSpProvider());
