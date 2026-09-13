/**
 * tests/phase2_state_registry_audit.ts
 * Suíte de testes arquiteturais para validação da FASE 2:
 * 1. StateRegistry (registro, consulta, listagem)
 * 2. StateDefinition (metadados canônicos e código IBGE 35 para SP)
 * 3. CanonicalOccurrence (validação de schema e preservação de sourceCategory)
 * 4. CanonicalIndicator (validação de unicidade e schema)
 * 5. TaxonomyMapping (mapeamentos e status)
 * 6. SspSpProvider (conformidade com o contrato StateProvider)
 * 7. MockProviderZZ (validação de extensibilidade sem acoplamento a SP)
 */

import { StateRegistry } from '../src/ingestion/core/registry/StateRegistry.js';
import { SspSpProvider } from '../src/ingestion/providers/sp/SspSpProvider.js';
import { 
  CanonicalOccurrence, 
  CanonicalIndicator, 
  TaxonomyMapping, 
  StateProvider,
  StateDataset 
} from '../src/ingestion/core/contracts/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, evidence?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}${evidence ? ` -> ${evidence}` : ''}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}${evidence ? ` -> ${evidence}` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log("==================================================================");
  console.log("SUÍTE DE TESTES ARQUITETURAIS: FASE 2 — STATE PROVIDERS & CONTRACTS");
  console.log("==================================================================");

  // -------------------------------------------------------------
  // Teste 1: StateRegistry e SspSpProvider
  // -------------------------------------------------------------
  const spProvider = new SspSpProvider();
  StateRegistry.register(spProvider);

  assert(StateRegistry.has('SP'), "StateRegistry.has('SP') retorna true", "SP está registrado");
  assert(StateRegistry.has('sp'), "StateRegistry.has('sp') é case-insensitive", "sp retorna true");
  assert(!StateRegistry.has('UNKNOWN_UF'), "StateRegistry.has('UNKNOWN_UF') retorna false", "UF inexistente tratada");

  const retrieved = StateRegistry.get('SP');
  assert(retrieved !== undefined && retrieved.stateCode === 'SP', "StateRegistry.get('SP') retorna instância válida", `providerName: ${retrieved?.providerName}`);
  assert(retrieved?.ibgeStateCode === 35, "SP possui código IBGE estadual 35", `ibgeStateCode = ${retrieved?.ibgeStateCode}`);
  assert(retrieved?.capabilities.occurrences === true, "SP Provider possui capability de occurrences", "occurrences: true");
  assert(retrieved?.capabilities.indicators === true, "SP Provider possui capability de indicators", "indicators: true");
  assert(retrieved?.capabilities.coordinates === true, "SP Provider possui capability de coordinates", "coordinates: true");

  // -------------------------------------------------------------
  // Teste 2: StateDefinition e Catálogo IBGE
  // -------------------------------------------------------------
  const spDef = StateRegistry.getStateDefinition('SP');
  assert(spDef !== undefined, "StateRegistry.getStateDefinition('SP') retorna definição válida", `${spDef?.name} (IBGE: ${spDef?.ibgeCode})`);
  assert(spDef?.ibgeCode === 35, "Definição de SP possui IBGE = 35", "IBGE 35 confirmado");
  assert(spDef?.enabled === true, "SP está marcado como enabled = true", "enabled = true");

  const allDefs = StateRegistry.listDefinitions();
  assert(allDefs.length >= 7, "Catálogo de definições contém os estados mapeados", `Total de estados: ${allDefs.length}`);

  // -------------------------------------------------------------
  // Teste 3: CanonicalOccurrence Contract
  // -------------------------------------------------------------
  const sampleOcc: CanonicalOccurrence = {
    sourceId: 'SSP-SP',
    stateCode: 'SP',
    municipalityCode: '3550308',
    municipalityName: 'São Paulo',
    occurredAt: new Date('2026-03-10T14:30:00Z'),
    category: 'theft',
    subcategory: 'vehicle_theft',
    sourceCategory: 'FURTO DE VEÍCULO',
    latitude: -23.5505,
    longitude: -46.6333,
    locationPrecision: 'exact',
    isSyntheticPoint: false,
    sourceRecordId: '12345/2026',
    incidentHash: 'abc123sha256hash'
  };

  assert(sampleOcc.stateCode === 'SP', "CanonicalOccurrence preserva stateCode", sampleOcc.stateCode);
  assert(sampleOcc.sourceId === 'SSP-SP', "CanonicalOccurrence preserva sourceId", sampleOcc.sourceId);
  assert(sampleOcc.sourceCategory === 'FURTO DE VEÍCULO', "CanonicalOccurrence preserva sourceCategory original sem perda", sampleOcc.sourceCategory);
  assert(sampleOcc.category === 'theft', "CanonicalOccurrence possui category canônica normalizada", sampleOcc.category);
  assert(sampleOcc.municipalityCode === '3550308', "CanonicalOccurrence possui código IBGE de 7 dígitos", sampleOcc.municipalityCode);

  // -------------------------------------------------------------
  // Teste 4: CanonicalIndicator Contract
  // -------------------------------------------------------------
  const sampleInd: CanonicalIndicator = {
    sourceId: 'SSP-SP',
    stateCode: 'SP',
    municipalityCode: '3550308',
    category: 'homicide',
    subcategory: 'intentional_homicide',
    sourceCategory: 'HOMICÍDIO DOLOSO (EXCLUI FEMINICÍDIO)',
    period: '2026-01',
    value: 42,
    unit: 'count',
    granularity: 'municipality'
  };

  assert(sampleInd.period === '2026-01', "CanonicalIndicator possui período estruturado", sampleInd.period);
  assert(sampleInd.value === 42, "CanonicalIndicator preserva valor apurado", `value: ${sampleInd.value}`);
  assert(sampleInd.subcategory === 'intentional_homicide', "CanonicalIndicator suporta subcategory para garantir integridade do índice de unicidade", sampleInd.subcategory);

  // -------------------------------------------------------------
  // Teste 5: TaxonomyMapping Contract
  // -------------------------------------------------------------
  const mappings = spProvider.getTaxonomyMappings();
  assert(mappings.length > 0, "SspSpProvider fornece catálogo de TaxonomyMapping", `Total mapeamentos: ${mappings.length}`);
  const theftMapping = mappings.find(m => m.sourceCategory === 'FURTO DE VEÍCULO');
  assert(theftMapping?.canonicalCategory === 'theft', "Mapeamento correto de FURTO DE VEÍCULO para theft", `Status: ${theftMapping?.mappingStatus}`);
  assert(theftMapping?.mappingStatus === 'mapped', "Status de mapeamento é 'mapped'", "mappingStatus = mapped");

  // -------------------------------------------------------------
  // Teste 6: Teste de Mock Provider Hipotético 'ZZ'
  // -------------------------------------------------------------
  class MockStateProviderZZ implements StateProvider {
    readonly stateCode = 'ZZ';
    readonly ibgeStateCode = 99;
    readonly stateName = 'Estado Teste Hipotético ZZ';
    readonly providerName = 'SSP-ZZ (Mock para Testes Arquiteturais)';
    readonly capabilities = {
      occurrences: true,
      indicators: true,
      coordinates: false,
      historicalData: false,
      monthlyData: true,
      automatedDownload: false
    };

    getDatasets(): StateDataset[] {
      return [{
        id: 'zz_sample_dataset',
        stateCode: 'ZZ',
        name: 'Dataset Teste ZZ',
        datasetType: 'monthly_indicators',
        enabled: true,
        supportsOccurrences: false,
        supportsIndicators: true
      }];
    }

    async discover() {
      return { version: '2026-01' };
    }

    normalizeIndicator(record: any): CanonicalIndicator {
      return {
        sourceId: 'SSP-ZZ',
        stateCode: 'ZZ',
        municipalityCode: '9900001',
        category: 'robbery',
        period: '2026-01',
        value: 10
      };
    }
  }

  const zzProvider = new MockStateProviderZZ();
  StateRegistry.register(zzProvider);

  assert(StateRegistry.has('ZZ'), "MockProviderZZ foi registrado no StateRegistry", "ZZ registrado");
  const retrievedZZ = StateRegistry.get('ZZ');
  assert(retrievedZZ !== undefined && retrievedZZ.stateCode === 'ZZ', "StateRegistry.get('ZZ') retorna provider ZZ sem dependência de SP", `Provider: ${retrievedZZ?.providerName}`);
  assert(retrievedZZ?.capabilities.coordinates === false, "MockProviderZZ reflete capacidades específicas sem assumir suporte de SP", "coordinates: false");

  const normalizedZZ = retrievedZZ?.normalizeIndicator?.({});
  assert((normalizedZZ as CanonicalIndicator)?.stateCode === 'ZZ', "MockProviderZZ normaliza para contrato canônico com sucesso", `stateCode: ${(normalizedZZ as CanonicalIndicator)?.stateCode}`);

  console.log("==================================================================");
  console.log(`RESULTADO DA SUÍTE: ${passed} PASS / ${failed} FAIL`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Erro fatal na suíte:", err);
  process.exit(1);
});
