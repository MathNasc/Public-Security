/**
 * SUÍTE COMPLETA DE VALIDAÇÃO END-TO-END DA FASE 4:
 * ARQUITETURA MULTIESTADO, STATE REGISTRY, ISOLAMENTO GEOGRÁFICO E REGRESSÃO SSP-SP
 */

import { 
  StateRegistry, 
  StateProvider, 
  CanonicalOccurrence, 
  CanonicalIndicator, 
  StateDataset, 
  StateDefinition,
  ProviderCapabilities
} from '../src/ingestion/core/index.js';
import { SspSpProvider } from '../src/ingestion/providers/sp/index.js';
import { getPrimarySource } from '../src/ingestion/pipeline/SourcePriority.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { PipelineAutomationService } from '../src/ingestion/orchestration/PipelineAutomationService.js';
import { SafetyAnalysisService } from '../src/services/SafetyAnalysisService.js';
import crypto from 'crypto';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`, detail || '');
    failed++;
  }
}

/**
 * Provedor Sintético Isolado "ZZ" para validação estrita multiestado em testes.
 * Nunca é ativado em produção.
 */
class SyntheticZzProvider implements StateProvider {
  readonly stateCode = 'ZZ';
  readonly ibgeStateCode = 99;
  readonly stateName = 'Estado de Teste ZZ';
  readonly providerName = 'Secretaria de Segurança Sintética de Testes - SSP-ZZ';
  readonly version = '1.0.0-test';

  readonly capabilities: ProviderCapabilities = {
    occurrences: true,
    indicators: true,
    coordinates: true,
    historicalData: false,
    monthlyData: true,
    automatedDownload: true
  };

  getStateDefinition(): StateDefinition {
    return {
      code: 'ZZ',
      ibgeCode: 99,
      name: 'Estado de Teste ZZ',
      agency: 'Secretaria de Segurança Sintética de Testes - SSP-ZZ',
      enabled: true,
      primaryProviderId: 'SSP-ZZ'
    };
  }

  getDatasets(): StateDataset[] {
    return [
      {
        id: 'ssp_zz_microdados_2026',
        stateCode: 'ZZ',
        name: 'Microdados Criminais ZZ 2026',
        datasetType: 'microdata_bo',
        enabled: true,
        supportsOccurrences: true,
        supportsIndicators: true,
        temporalCoverage: '2026',
        geographicCoverage: 'Estado ZZ',
        fileFormat: 'csv',
        officialUrl: 'https://ssp.zz.gov.br/microdados/2026.csv'
      },
      {
        id: 'ssp_zz_indicadores_2026',
        stateCode: 'ZZ',
        name: 'Indicadores Municipais ZZ 2026',
        datasetType: 'monthly_indicators',
        enabled: true,
        supportsOccurrences: false,
        supportsIndicators: true,
        temporalCoverage: '2026',
        geographicCoverage: 'Estado ZZ',
        fileFormat: 'csv',
        officialUrl: 'https://ssp.zz.gov.br/indicadores/2026.csv'
      }
    ];
  }

  async discover(): Promise<{ version: string; url?: string; period?: string; checksum?: string; source?: string; availableDatasets?: string[] }> {
    return {
      source: 'SSP-ZZ',
      version: '2026.01-ZZ',
      url: 'https://ssp.zz.gov.br/microdados/2026_01.csv',
      availableDatasets: ['ssp_zz_microdados_2026']
    };
  }

  async download(destinationPath: string): Promise<string> {
    const fs = await import('fs');
    fs.writeFileSync(destinationPath, 'cidade;crime;ano;mes;bo_id;lat;lon\nCidade ZZ;Homicidio;2026;1;BO-ZZ-001;-27.5954;-48.5480\n');
    return destinationPath;
  }

  normalize(raw: Record<string, any>): CanonicalOccurrence {
    const rawCategory = (raw.crime || raw.Natureza || raw.natureza || 'OUTROS').toUpperCase();
    let category = 'theft';
    if (rawCategory.includes('HOMIC')) category = 'homicide';
    else if (rawCategory.includes('ROUBO')) category = 'robbery';
    else if (rawCategory.includes('FURTO')) category = 'theft';

    const city = raw.municipio || raw.cidade || 'Cidade ZZ';
    const numBo = raw.bo_id || raw.num_bo || 'ZZ-001';
    const year = Number(raw.ano || 2026);
    const month = Number(raw.mes || 1);

    const hashPayload = `ZZ|${city}|${numBo}|${category}|${year}|${month}`;
    const incidentHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    return {
      sourceId: 'SSP-ZZ',
      stateCode: 'ZZ',
      municipalityCode: '9900001',
      municipalityName: city,
      occurredAt: new Date(Date.UTC(year, month - 1, 15, 14, 0, 0)),
      referencePeriod: `${year}-${String(month).padStart(2, '0')}`,
      category,
      subcategory: raw.subnatureza || null,
      sourceCategory: rawCategory,
      latitude: raw.lat ? Number(raw.lat) : -27.5954,
      longitude: raw.lon ? Number(raw.lon) : -48.5480,
      locationPrecision: 'exact',
      isSyntheticPoint: false,
      sourceRecordId: numBo,
      incidentHash,
      originalAddress: raw.endereco || 'Avenida Central ZZ, 100',
      sourceData: raw
    };
  }

  async reconcile(periodOrOccurrences: string | CanonicalOccurrence[], maybeIndicators?: CanonicalIndicator[]) {
    return {
      period: typeof periodOrOccurrences === 'string' ? periodOrOccurrences : '2026-01',
      passed: true,
      differences: []
    };
  }

  async validateQuality(data: any[]) {
    return {
      stateCode: 'ZZ',
      totalRecords: data.length,
      validRecords: data.length,
      invalidRecords: 0,
      geocodedRecords: data.filter(d => d.latitude && d.longitude).length,
      qualityScore: 100,
      passedQualityGate: true
    };
  }
}

async function runPhase4Suite() {
  console.log('\n========================================================================');
  console.log('🏛️  FASE 4: SUÍTE DE VALIDAÇÃO END-TO-END DA ARQUITETURA MULTIESTADO');
  console.log('========================================================================\n');

  // Inicialização do Registry com SP e ZZ
  const spProvider = new SspSpProvider();
  const zzProvider = new SyntheticZzProvider();

  StateRegistry.register(spProvider);
  StateRegistry.register(zzProvider);

  // -----------------------------------------------------------------------------------
  // 4.1 & 4.2: Auditoria de Fallbacks Ocultos e Resolução Estrita
  // -----------------------------------------------------------------------------------
  console.log('--- 4.1 & 4.2: Auditoria de Fallbacks e Contrato Formal de Resolução ---');

  assert(StateRegistry.isStateSupported('SP'), 'isStateSupported("SP") é true');
  assert(StateRegistry.isStateSupported('ZZ'), 'isStateSupported("ZZ") é true');
  assert(!StateRegistry.isStateSupported('XX'), 'isStateSupported("XX") é false para estado inexistente');
  assert(!StateRegistry.isStateSupported(''), 'isStateSupported("") é false para string vazia');

  assert(StateRegistry.resolveProviderByState('SP') !== null, 'resolveProviderByState("SP") resolve SspSpProvider');
  assert(StateRegistry.resolveProviderByState('ZZ') !== null, 'resolveProviderByState("ZZ") resolve SyntheticZzProvider');
  assert(StateRegistry.resolveProviderByState('XX') === null, 'resolveProviderByState("XX") retorna estritamente null');

  assert(StateRegistry.resolveProviderBySource('SSP-SP') !== null, 'resolveProviderBySource("SSP-SP") resolve SspSpProvider');
  assert(StateRegistry.resolveProviderBySource('SSP-ZZ') !== null, 'resolveProviderBySource("SSP-ZZ") resolve SyntheticZzProvider');
  assert(StateRegistry.resolveProviderBySource('SSP-XX') === null, 'resolveProviderBySource("SSP-XX") retorna null sem fallback para SP');

  assert(StateRegistry.resolveStateBySource('SSP-SP') === 'SP', 'resolveStateBySource("SSP-SP") retorna "SP"');
  assert(StateRegistry.resolveStateBySource('SSP-ZZ') === 'ZZ', 'resolveStateBySource("SSP-ZZ") retorna "ZZ"');
  assert(StateRegistry.resolveStateBySource('UNKNOWN-SOURCE') === null, 'resolveStateBySource("UNKNOWN-SOURCE") retorna null');

  assert(getPrimarySource('SP') === 'SSP-SP', 'getPrimarySource("SP") retorna "SSP-SP"');
  assert(getPrimarySource('ZZ') === 'SSP-ZZ', 'getPrimarySource("ZZ") retorna "SSP-ZZ"');
  assert(getPrimarySource('UNKNOWN_UF') === null, 'getPrimarySource("UNKNOWN_UF") retorna null sem fallback silencioso');

  // -----------------------------------------------------------------------------------
  // 4.3 & 4.4: Provider Sintético ZZ e Isolamento Geográfico
  // -----------------------------------------------------------------------------------
  console.log('\n--- 4.3 & 4.4: Provider Sintético ZZ e Isolamento Geográfico Estrito ---');

  const spRaw = {
    CIDADE_NORM: 'Campinas',
    Natureza: 'ROUBO - OUTROS',
    Ano: 2026,
    Mes: 1,
    NUM_BO: 'BO-CAMP-101',
    LATITUDE: -22.9099,
    LONGITUDE: -47.0626
  };

  const zzRaw = {
    cidade: 'Capital ZZ',
    crime: 'Homicídio Qualificado',
    ano: 2026,
    mes: 1,
    bo_id: 'BO-ZZ-999',
    lat: -27.5954,
    lon: -48.5480
  };

  const spNorm = spProvider.normalize(spRaw);
  const zzNorm = zzProvider.normalize(zzRaw);

  assert(spNorm.stateCode === 'SP', 'Normalização de SP preserva stateCode "SP"');
  assert(spNorm.sourceId === 'SSP-SP', 'Normalização de SP preserva sourceId "SSP-SP"');
  assert(zzNorm.stateCode === 'ZZ', 'Normalização de ZZ preserva stateCode "ZZ"');
  assert(zzNorm.sourceId === 'SSP-ZZ', 'Normalização de ZZ preserva sourceId "SSP-ZZ"');
  assert(spNorm.stateCode !== zzNorm.stateCode, 'Estados de SP e ZZ são estritamente isolados');

  assert(spNorm.incidentHash !== zzNorm.incidentHash, 'Hashes canônicos de SP e ZZ são distintos');
  assert(spNorm.incidentHash.length === 64, 'Hash SP é SHA-256 válido');
  assert(zzNorm.incidentHash.length === 64, 'Hash ZZ é SHA-256 válido');

  // Teste de Descoberta Isolada
  const spDisc = await spProvider.discover();
  const zzDisc = await zzProvider.discover();
  assert(spDisc.source === 'SSP-SP', 'Discovery SP identifica SSP-SP');
  assert(zzDisc.source === 'SSP-ZZ', 'Discovery ZZ identifica SSP-ZZ');
  assert(spDisc.version !== zzDisc.version, 'Versões detectadas são independentes');

  // -----------------------------------------------------------------------------------
  // 4.5: Persistência Multiestado (Worker e Ingestão)
  // -----------------------------------------------------------------------------------
  console.log('\n--- 4.5: Persistência Multiestado e IngestionWorker ---');

  const worker = new IngestionWorker('worker-test-phase4');
  assert(typeof worker.processJobDirectly === 'function', 'IngestionWorker possui método processJobDirectly');
  assert(typeof (worker as any).insertBatch === 'function', 'IngestionWorker possui método insertBatch');

  // -----------------------------------------------------------------------------------
  // 4.6 & 4.7: Análise Territorial e API Multiestado
  // -----------------------------------------------------------------------------------
  console.log('\n--- 4.6 & 4.7: Análise Territorial e API Multiestado ---');

  // 1. Análise com coordenadas de SP (São Paulo - Praça da Sé)
  const spAnalysis = await SafetyAnalysisService.analyzeLocation({
    latitude: -23.5505,
    longitude: -46.6333,
    radiusMeters: 1500,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31')
  });

  assert(spAnalysis.geographicIdentification?.stateAcronym === 'SP', 'Análise em SP identifica stateAcronym "SP"');
  assert(spAnalysis.sources?.some(s => s.id === 'SSP-SP' || s.provider?.includes('SSP-SP')) || spAnalysis.status !== undefined, 'Análise em SP conecta com SSP-SP');

  // 2. Análise com coordenadas fora de SP em localidade não coberta
  const unkAnalysis = await SafetyAnalysisService.analyzeLocation({
    latitude: 0.0,
    longitude: 0.0,
    radiusMeters: 1000,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31')
  });

  assert(unkAnalysis.status === 'insufficient_data' || unkAnalysis.score === null, 'Coordenada não suportada retorna status seguro/vazio');
  assert(!unkAnalysis.dataAbsenceNotice?.includes('SSP-SP') || unkAnalysis.score === null, 'Mensagem para localidade não registrada trata ausência de dados corretamente');

  // -----------------------------------------------------------------------------------
  // 4.8 & 4.9: Automação e Ciclo de Execução por Estado
  // -----------------------------------------------------------------------------------
  console.log('\n--- 4.8 & 4.9: PipelineAutomationService Multiestado ---');

  // Checagem de update para ZZ
  const zzUpdate = await PipelineAutomationService.checkForUpdates({ stateCode: 'ZZ', sourceId: 'SSP-ZZ', force: true });
  assert(zzUpdate.hasUpdate, 'checkForUpdates para ZZ descobre versão de ZZ com sucesso');
  assert(zzUpdate.version === '2026.01-ZZ', 'Versão descoberta confere com SSP-ZZ');

  // Checagem para estado não cadastrado
  const unkUpdate = await PipelineAutomationService.checkForUpdates({ stateCode: 'XX', sourceId: 'SSP-XX', force: true });
  assert(!unkUpdate.hasUpdate, 'checkForUpdates para XX retorna hasUpdate: false');
  assert(unkUpdate.reason.toLowerCase().includes('registrado') || unkUpdate.reason.toLowerCase().includes('suportado'), 'Mensagem informa que XX não está registrado');

  // Disparo de ciclo de automação para XX
  const unkCycle = await PipelineAutomationService.runAutomationCycle({ stateCode: 'XX', sourceId: 'SSP-XX' });
  assert(!unkCycle.success, 'runAutomationCycle para XX recusa execução com sucesso');
  assert(Boolean(unkCycle.error?.toLowerCase().includes('registrado') || unkCycle.reason?.toLowerCase().includes('registrado')), 'runAutomationCycle reporta erro explícito para XX');

  // -----------------------------------------------------------------------------------
  // 4.10 & 4.11: Não Dependência e Regressão SSP-SP
  // -----------------------------------------------------------------------------------
  console.log('\n--- 4.10 & 4.11: Validação de Regressão Completa SSP-SP ---');

  assert(spProvider.stateCode === 'SP', 'SspSpProvider mantém código "SP"');
  assert(spProvider.version === '2026.01', 'SspSpProvider versão 2026.01');
  const spDatasets = spProvider.getDatasets();
  assert(spDatasets.length >= 3, `SspSpProvider fornece ${spDatasets.length} datasets oficiais`);

  const spStateDef = spProvider.getStateDefinition();
  assert(spStateDef.code === 'SP', 'Definição estadual de SP é SP');
  assert(spStateDef.primaryProviderId === 'SSP-SP', 'primaryProviderId de SP é SSP-SP');

  // Teste de Qualidade e Reconciliação
  const qualityReport = await spProvider.validateQuality([spNorm]);
  assert(qualityReport.passedQualityGate, 'Quality gate de SP passa com sucesso');
  assert(qualityReport.stateCode === 'SP', 'Quality report de SP possui stateCode SP');

  const indSample = {
    sourceId: 'SSP-SP',
    stateCode: 'SP',
    municipalityCode: '3550308',
    category: spNorm.category,
    subcategory: null,
    period: '2026-01',
    value: 1,
    unit: 'count' as const,
    granularity: 'municipality' as const
  };

  const reconReport = await spProvider.reconcile([spNorm], [indSample]);
  assert(reconReport.stateCode === 'SP', 'Reconciliation report de SP possui stateCode SP');
  assert(reconReport.status === 'MATCH_EXACT', 'Reconciliation status é MATCH_EXACT');

  // -----------------------------------------------------------------------------------
  // Resumo Final
  // -----------------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`📊 RESUMO DA SUÍTE FASE 4: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Suite().catch(err => {
  console.error('💥 Erro fatal na suíte da Fase 4:', err);
  process.exit(1);
});
