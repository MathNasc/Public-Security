/**
 * Teste e Auditoria da FASE 3: Migração Controlada do SSP-SP para State Provider
 */

import { StateRegistry } from '../src/ingestion/core/index.js';
import { SspSpProvider } from '../src/ingestion/providers/sp/index.js';
import { SspSpAdapter } from '../src/ingestion/adapters/ssp/SspSpAdapter.js';
import { SspSpHistoricalCatalogAdapter } from '../src/ingestion/adapters/ssp/SspSpHistoricalCatalogAdapter.js';
import { SspIdentityService } from '../src/ingestion/adapters/ssp/SspIdentity.js';
import { SspReconciliationService } from '../src/ingestion/adapters/ssp/SspReconciliationService.js';
import { PipelineAutomationService } from '../src/ingestion/orchestration/PipelineAutomationService.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { SafetyAnalysisService } from '../src/services/SafetyAnalysisService.js';

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

async function runPhase3Audit() {
  console.log('\n======================================================');
  console.log('🏛️  INICIANDO AUDITORIA DA FASE 3: MIGRAÇÃO DO SSP-SP');
  console.log('======================================================\n');

  // 1. Registro e Resolução do SspSpProvider
  console.log('--- 1. Validação do Provider SSP-SP no StateRegistry ---');
  const provider = new SspSpProvider();
  StateRegistry.register(provider);

  assert(StateRegistry.has('SP'), 'StateRegistry possui provedor para SP');
  assert(StateRegistry.get('SP') !== undefined, 'StateRegistry.get("SP") retorna instância do provider');
  assert(StateRegistry.get('sp') !== undefined, 'StateRegistry.get("sp") é case-insensitive');
  assert(StateRegistry.get('SP')?.stateCode === 'SP', 'Provider stateCode é SP');
  assert(StateRegistry.get('SP')?.providerName === 'Secretaria de Segurança Pública de São Paulo - SSP-SP', 'Provider providerName confere com SSP-SP');

  // 2. Resolução por SourceId
  console.log('\n--- 2. Resolução por Source ID ---');
  assert(StateRegistry.resolveBySource('SSP-SP') !== undefined, 'resolveBySource("SSP-SP") localiza SspSpProvider');
  assert(StateRegistry.resolveBySource('ssp-sp') !== undefined, 'resolveBySource("ssp-sp") é case-insensitive');
  assert(StateRegistry.resolveBySource('SSP-SP-HISTORICAL') !== undefined, 'resolveBySource("SSP-SP-HISTORICAL") resolve para SP');
  assert(StateRegistry.resolveStateBySource('SSP-SP') === 'SP', 'resolveStateBySource("SSP-SP") retorna "SP"');
  assert(StateRegistry.resolveStateBySource('SSP-RJ') === 'RJ', 'resolveStateBySource("SSP-RJ") retorna "RJ"');
  assert(StateRegistry.resolveStateBySource('SSP-MG') === 'MG', 'resolveStateBySource("SSP-MG") retorna "MG"');

  // 3. Catálogo de Datasets Oficiais
  console.log('\n--- 3. Catálogo e Metadados de Datasets Oficiais de SP ---');
  const datasets = provider.getDatasets();
  assert(Array.isArray(datasets) && datasets.length >= 3, `Provider expõe ${datasets.length} datasets oficiais`);
  assert(datasets.some(d => d.id === 'ssp_sp_microdados_2026'), 'Contém dataset ssp_sp_microdados_2026');
  assert(datasets.some(d => d.id === 'ssp_sp_microdados_2025'), 'Contém dataset ssp_sp_microdados_2025');
  assert(datasets.some(d => d.id === 'ssp_sp_mdip_2013_2026'), 'Contém dataset ssp_sp_mdip_2013_2026');

  // 4. Teste de Descoberta Dinâmica
  console.log('\n--- 4. Descoberta Dinâmica via Provider ---');
  const discovery = await provider.discover();
  assert(Boolean(discovery.source), 'Discovery retorna source');
  assert(Boolean(discovery.version), `Discovery retorna versão detectada (${discovery.version})`);
  assert(Boolean(discovery.url), `Discovery retorna URL oficial (${discovery.url})`);

  // 5. Teste de Normalização de Ocorrências Canônicas
  console.log('\n--- 5. Normalização para Ocorrência Canônica ---');
  const rawRecord = {
    CIDADE_NORM: 'São Paulo',
    MUNICIPIO_CIRCUNSCRICAO: 'São Paulo',
    Municipio: 'São Paulo',
    Natureza: 'ROUBO - OUTROS',
    Ano: 2026,
    Mes: 1,
    Total: 15,
    LATITUDE: -23.5505,
    LONGITUDE: -46.6333,
    LOGRADOURO: 'Praça da Sé',
    NUM_BO: '1234/2026',
    DELEGACIA_NOME: '01 DP Sé'
  };

  const canonical = provider.normalize(rawRecord);
  assert(canonical.stateCode === 'SP', 'Normalização define stateCode SP');
  assert(Boolean(canonical.category), `Categoria mapeada (${canonical.category})`);
  assert(Boolean(canonical.municipalityName), `Município definido (${canonical.municipalityName})`);
  assert(canonical.locationPrecision === 'exact', 'Precisão espacial definida');
  assert(canonical.incidentHash.length === 64, `Hash de incidente canônico gerado (${canonical.incidentHash})`);

  // 6. Teste de Hashing e Identidade Canônica
  console.log('\n--- 6. Geração de Identidade Única SHA-256 ---');
  const hash1 = SspIdentityService.generateOccurrenceId('SP', rawRecord);
  const hash2 = SspIdentityService.generateOccurrenceId('SP', rawRecord);
  assert(hash1 === hash2, 'Hash de ocorrência é estritamente determinístico');
  assert(hash1.length === 64, 'Hash SHA-256 possui 64 caracteres');

  // 7. Teste de Reconciliação Estatística
  console.log('\n--- 7. Reconciliação Estatística ---');
  const reconciliation = await provider.reconcile(2026);
  assert(Boolean(reconciliation.period), `Reconciliação executada para período ${reconciliation.period}`);
  assert(Array.isArray(reconciliation.differences), 'Retorna lista estruturada de divergências/comparações');

  // 8. Compatibilidade de Re-exportações Legadas
  console.log('\n--- 8. Compatibilidade de Módulos e Re-exportações Legadas ---');
  const legacyAdapter = new SspSpAdapter();
  assert(legacyAdapter.metadata().coverage === 'SP', 'SspSpAdapter legado acessível e com cobertura SP');
  const historicalAdapter = new SspSpHistoricalCatalogAdapter();
  assert(historicalAdapter.metadata().agency === 'SSP-SP', 'SspSpHistoricalCatalogAdapter legado acessível');

  // 9. Worker Adapter Selection
  console.log('\n--- 9. Worker Adapter Selection via StateRegistry ---');
  const worker = new IngestionWorker('test-worker');
  const selectedAdapter = (worker as any).selectAdapter('SSP-SP');
  assert(selectedAdapter !== null, 'Worker seleciona adapter para SSP-SP com sucesso');
  assert(selectedAdapter instanceof SspSpAdapter, 'Adapter instanciado é SspSpAdapter');

  // 10. SafetyAnalysisService State Provider Lookup
  console.log('\n--- 10. SafetyAnalysisService State Lookup ---');
  const analysisService = new SafetyAnalysisService();
  const unsupportedResult = await analysisService.analyze({
    lat: -15.7975,
    lon: -47.8919, // Brasília (DF) - Provedor não ativado
    radiusMeters: 1000,
    periodString: '12m'
  });
  assert(unsupportedResult.score === null, 'Retorna score nulo para UF sem provedor ativo (DF)');
  assert(unsupportedResult.status === 'insufficient_data', 'Status reporta insufficient_data para UF sem provedor');

  console.log('\n======================================================');
  console.log(`📊 RESULTADO FINAL DA AUDITORIA DA FASE 3:`);
  console.log(`   Passaram: ${passed}`);
  console.log(`   Falharam: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Audit().catch(err => {
  console.error('Erro na execução do teste da FASE 3:', err);
  process.exit(1);
});
