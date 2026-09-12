import { SspGoAdapter } from '../src/ingestion/adapters/ssp-go/SspGoAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators, geographicMunicipalities } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSspGoAudit() {
  console.log("================================================================================");
  console.log("       AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SSP-GO (GOIÁS)                 ");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details || 'Condição não satisfeita'}`);
      failed++;
    }
  }

  // 0. Assegurar Fonte SSP-GO e Municípios Principais de Goiás no Banco de Dados
  const goSource = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-go'`);
  if (goSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SSP-GO',
      name: 'Secretaria de Estado da Segurança Pública de Goiás',
      provider: 'SSP-GO',
      coverage: 'GO',
      state: 'GO',
      sourceType: 'csv',
      url: 'https://dadosabertos.ssp.go.gov.br/',
      officialUrl: 'https://www.seguranca.go.gov.br/',
      documentationUrl: 'https://www.seguranca.go.gov.br/estatisticas/',
      description: 'Estatísticas criminais e indicadores consolidados pelo OSPEGO para os 246 municípios goianos.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Assegura municípios de GO em geographic_municipalities
  const goMunis = [
    { code: '5208707', stateAcronym: 'GO', stateName: 'Goiás', name: 'Goiânia', normalizedName: 'goiania', latitude: -16.6869, longitude: -49.2648 },
    { code: '5201405', stateAcronym: 'GO', stateName: 'Goiás', name: 'Aparecida de Goiânia', normalizedName: 'aparecida de goiania', latitude: -16.8228, longitude: -49.2481 },
    { code: '5201108', stateAcronym: 'GO', stateName: 'Goiás', name: 'Anápolis', normalizedName: 'anapolis', latitude: -16.3267, longitude: -48.9533 },
    { code: '5218805', stateAcronym: 'GO', stateName: 'Goiás', name: 'Rio Verde', normalizedName: 'rio verde', latitude: -17.7925, longitude: -50.9192 },
    { code: '5200258', stateAcronym: 'GO', stateName: 'Goiás', name: 'Águas Lindas de Goiás', normalizedName: 'aguas lindas de goias', latitude: -15.7622, longitude: -48.2817 },
    { code: '5212501', stateAcronym: 'GO', stateName: 'Goiás', name: 'Luziânia', normalizedName: 'luziania', latitude: -16.2528, longitude: -47.9500 },
    { code: '5221858', stateAcronym: 'GO', stateName: 'Goiás', name: 'Valparaíso de Goiás', normalizedName: 'valparaiso de goias', latitude: -16.0689, longitude: -47.9758 },
    { code: '5220454', stateAcronym: 'GO', stateName: 'Goiás', name: 'Senador Canedo', normalizedName: 'senador canedo', latitude: -16.7083, longitude: -49.0950 },
    { code: '5221403', stateAcronym: 'GO', stateName: 'Goiás', name: 'Trindade', normalizedName: 'trindade', latitude: -16.6492, longitude: -49.4889 },
    { code: '5208004', stateAcronym: 'GO', stateName: 'Goiás', name: 'Formosa', normalizedName: 'formosa', latitude: -15.5392, longitude: -47.3364 },
    { code: '5211503', stateAcronym: 'GO', stateName: 'Goiás', name: 'Itumbiara', normalizedName: 'itumbiara', latitude: -18.4194, longitude: -49.2158 },
    { code: '5211909', stateAcronym: 'GO', stateName: 'Goiás', name: 'Jataí', normalizedName: 'jatai', latitude: -17.8814, longitude: -51.7144 },
    { code: '5217609', stateAcronym: 'GO', stateName: 'Goiás', name: 'Planaltina', normalizedName: 'planaltina', latitude: -15.4528, longitude: -47.6139 },
    { code: '5215231', stateAcronym: 'GO', stateName: 'Goiás', name: 'Novo Gama', normalizedName: 'novo gama', latitude: -16.0592, longitude: -48.0389 }
  ];

  for (const muni of goMunis) {
    const existing = await db.select().from(geographicMunicipalities).where(eq(geographicMunicipalities.code, muni.code));
    if (existing.length === 0) {
      await db.insert(geographicMunicipalities).values({
        code: muni.code,
        stateAcronym: muni.stateAcronym,
        stateName: muni.stateName,
        name: muni.name,
        normalizedName: muni.normalizedName,
        latitude: muni.latitude,
        longitude: muni.longitude,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  const adapter = new SspGoAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SSP-GO' && meta.coverage === 'GO' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do estado de Goiás");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SSP-GO' && discovery.url.includes('dadosabertos'), "3. Discovery oficial apontando para repositório da SSP-GO");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial (Padrão SSP-GO)");

  const verticalHeaders = ['codigo_ibge', 'municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_GO_A', 'COLUNA_DESCONHECIDA_GO_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '5208707',
    municipio: 'Goiânia',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '18',
    latrocinio: '1',
    feminicidio: '1',
    lesao_morte: '0',
    roubo_veiculo: '84',
    furto_veiculo: '110',
    roubo_transeunte: '340',
    roubo_comercio: '58',
    roubo_residencia: '24',
    roubo_coletivo: '12',
    furto: '780',
    estupro: '22',
    trafico_drogas: '145',
    apreensao_armas: '55'
  }) as any[];

  assert(Array.isArray(parsedWide) && parsedWide.length === 8, "7. Desdobramento de colunas largas em 8 registros canônicos por município");
  const recHomicide = parsedWide.find(r => r.data.category === 'homicide');
  const recVehRob = parsedWide.find(r => r.data.category === 'vehicle_robbery');
  const recVehTheft = parsedWide.find(r => r.data.category === 'vehicle_theft');
  const recRobbery = parsedWide.find(r => r.data.category === 'robbery');
  const recTheft = parsedWide.find(r => r.data.category === 'theft');
  const recSexual = parsedWide.find(r => r.data.category === 'sexual_crime');
  const recDrugs = parsedWide.find(r => r.data.category === 'drug_related');
  const recArms = parsedWide.find(r => r.data.category === 'other');

  assert(recHomicide?.data.value === 20 && recHomicide?.data.period === '2024-01', "8. Mapeamento Wide: Mortes Violentas (20 vítimas = 18 hom + 1 latro + 1 fem)");
  assert(recVehRob?.data.value === 84 && recVehRob?.data.category === 'vehicle_robbery', "9. Mapeamento Canônico de Roubo de Veículo (84 ocorrências)");
  assert(recVehTheft?.data.value === 110 && recVehTheft?.data.category === 'vehicle_theft', "10. Mapeamento Canônico de Furto de Veículo (110 ocorrências)");
  assert(recRobbery?.data.value === 434 && recRobbery?.data.category === 'robbery', "11. Mapeamento Canônico de Roubos Agregados (434 ocorrências = 340 transeunte + 58 comercio + 24 residencia + 12 coletivo)");
  assert(recTheft?.data.value === 780 && recTheft?.data.category === 'theft', "12. Mapeamento Canônico de Furto Geral (780 ocorrências)");
  assert(recSexual?.data.value === 22 && recSexual?.data.category === 'sexual_crime', "13. Mapeamento Canônico de Crimes Sexuais (22 vítimas)");
  assert(recDrugs?.data.value === 145 && recDrugs?.data.category === 'drug_related', "14. Mapeamento Canônico de Tráfico de Drogas (145 ocorrências)");
  assert(recArms?.data.value === 55 && recArms?.data.unit === 'armas', "15. Mapeamento Canônico de Apreensão de Armas (55 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    codigo_ibge: '5201405',
    municipio: 'Aparecida de Goiânia',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Homicídio Doloso',
    quantidade: '14'
  }) as any[];

  assert(Array.isArray(parsedVertical) && parsedVertical.length === 1, "16. Parsing de registro vertical com conversão de nome do mês");
  assert(parsedVertical[0].data.category === 'homicide' && parsedVertical[0].data.period === '2024-02', "17. Conversão de Fevereiro para período 2024-02");

  // 5. Mapeamento Taxonômico Canônico
  assert(adapter.mapCrimeToCanonical('Homicídio Doloso') === 'homicide', "18. Taxonomia: Homicídio Doloso -> homicide");
  assert(adapter.mapCrimeToCanonical('Latrocínio') === 'homicide', "19. Taxonomia: Latrocínio -> homicide");
  assert(adapter.mapCrimeToCanonical('Feminicídio') === 'homicide', "20. Taxonomia: Feminicídio -> homicide");
  assert(adapter.mapCrimeToCanonical('Lesão Corporal Seguida de Morte') === 'homicide', "21. Taxonomia: Lesão Morte -> homicide");
  assert(adapter.mapCrimeToCanonical('CVLI') === 'homicide', "22. Taxonomia: CVLI -> homicide");
  assert(adapter.mapCrimeToCanonical('Tentativa de Homicídio') === 'bodily_harm', "23. Taxonomia: Tentativa de Homicídio -> bodily_harm");
  assert(adapter.mapCrimeToCanonical('Roubo de Veículo') === 'vehicle_robbery', "24. Taxonomia: Roubo de Veículo -> vehicle_robbery");
  assert(adapter.mapCrimeToCanonical('Furto de Veículo') === 'vehicle_theft', "25. Taxonomia: Furto de Veículo -> vehicle_theft");
  assert(adapter.mapCrimeToCanonical('Roubo em Transporte Coletivo') === 'robbery', "26. Taxonomia: Roubo Coletivo -> robbery");
  assert(adapter.mapCrimeToCanonical('Roubo a Transeunte') === 'robbery', "27. Taxonomia: Roubo a Transeunte -> robbery");
  assert(adapter.mapCrimeToCanonical('Roubo em Propriedade Rural') === 'robbery', "28. Taxonomia: Roubo Rural -> robbery");
  assert(adapter.mapCrimeToCanonical('Roubo de Carga') === 'cargo_theft', "29. Taxonomia: Roubo de Carga -> cargo_theft");
  assert(adapter.mapCrimeToCanonical('Estupro') === 'sexual_crime', "30. Taxonomia: Estupro -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Tráfico de Drogas') === 'drug_related', "31. Taxonomia: Tráfico de Drogas -> drug_related");
  assert(adapter.mapCrimeToCanonical('Delito Desconhecido') === 'other', "32. Taxonomia: Fallback seguro para other");

  // 6. Normalização Geoespacial de Municípios e Aliases de Goiás
  const normGyn = GeoNormalizationService.canonicalizeMunicipalityName('Gyn');
  const normAparecida = GeoNormalizationService.canonicalizeMunicipalityName('Ap de Goiania');
  const normAguasLindas = GeoNormalizationService.canonicalizeMunicipalityName('Aguas Lindas de GO');
  const normValparaiso = GeoNormalizationService.canonicalizeMunicipalityName('Valparaiso de GO');
  const normSenCanedo = GeoNormalizationService.canonicalizeMunicipalityName('Sen Canedo');
  const normPlanaltina = GeoNormalizationService.canonicalizeMunicipalityName('Planaltina de Goias');
  assert(normGyn === 'goiania', "33. Normalização de alias 'Gyn' -> 'goiania'");
  assert(normAparecida === 'aparecida de goiania', "34. Normalização de alias 'Ap de Goiania' -> 'aparecida de goiania'");
  assert(normAguasLindas === 'aguas lindas de goias', "35. Normalização de alias 'Aguas Lindas de GO' -> 'aguas lindas de goias'");
  assert(normValparaiso === 'valparaiso de goias', "36. Normalização de alias 'Valparaiso de GO' -> 'valparaiso de goias'");
  assert(normSenCanedo === 'senador canedo', "37. Normalização de alias 'Sen Canedo' -> 'senador canedo'");
  assert(normPlanaltina === 'planaltina', "38. Normalização de alias 'Planaltina de Goias' -> 'planaltina'");

  // 7. Teste End-to-End no Pipeline com Fixture Real de Goiás
  console.log("\n--- TESTE END-TO-END: PIPELINE COMPLETO COM FIXTURE DE GOIÁS ---");
  const goFixturePath = path.resolve('tests/fixtures/ssp-go/ssp_go_municipios_wide_real.csv');
  const goStream = fs.createReadStream(goFixturePath);

  // Armazenamento RAW Imutável
  const storedGo = await rawStorage.put('ssp-go', `audit_${Date.now()}`, 'ssp_go_municipios_wide_real.csv', goStream);
  assert(fs.existsSync(storedGo.path) && storedGo.metadata.size > 0, "39. Armazenamento RAW da fonte SSP-GO com SHA-256 e bytes calculados");

  // Criação de Job de Ingestão via JobManager
  const jobResult = await JobManager.createJob({
    sourceId: 'SSP-GO',
    datasetId: 'indicadores_municipais_go',
    rawFilePath: storedGo.path,
    originalFilename: 'ssp_go_municipios_wide_real.csv',
    checksum: storedGo.metadata.checksum,
    fileSize: storedGo.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "40. Criação e agendamento de Job de Ingestão para SSP-GO");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "41. Job persistido no banco com status QUEUED");

  // Execução pelo IngestionWorker
  const worker = new IngestionWorker('ssp-go-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "42. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 14, `43. 14 municípios goianos processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 112, `44. 112 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Verificação de Persistência no Banco de Dados
  const indicatorsInDb = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-GO'));

  assert(indicatorsInDb.length === 112, `45. Exatamente 112 indicadores de Goiás persistidos no banco (${indicatorsInDb.length} registros)`);

  const goianiaHomicides = indicatorsInDb.find(i => 
    i.municipalityCode === '5208707' && 
    i.category === 'homicide' && 
    i.period === '2024-01'
  );
  assert(goianiaHomicides?.value === 20, "46. Registro validado com precisão: Goiânia Jan/2024 Mortes Violentas = 20");

  const aparecidaVehRob = indicatorsInDb.find(i => 
    i.municipalityCode === '5201405' && 
    i.category === 'vehicle_robbery' && 
    i.period === '2024-01'
  );
  assert(aparecidaVehRob?.value === 45, "47. Registro validado com precisão: Aparecida de Goiânia Jan/2024 Roubo de Veículos = 45");

  // 9. Teste de Idempotência e Reprocessamento
  console.log("\n--- TESTE DE IDEMPOTÊNCIA E REPROCESSAMENTO ---");
  const countBeforeReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-GO'));

  const reprocessJob = await JobManager.reprocessJob(jobResult.jobId);
  assert(reprocessJob.success && !!reprocessJob.jobId, "48. Agendamento de reprocessamento a partir do RAW preservado");

  const [dbReprocessJob] = await db.select().from(dataImports).where(eq(dataImports.id, reprocessJob.jobId));
  const reprocessResult = await worker.processJobDirectly(dbReprocessJob);
  assert(reprocessResult.success, "49. IngestionWorker conclui reprocessamento com sucesso");

  const countAfterReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-GO'));

  assert(
    Number(countBeforeReprocess[0].count) === Number(countAfterReprocess[0].count),
    "50. Idempotência absoluta garantida: contagem de indicadores não duplica nem se altera após reprocessamento"
  );

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`  RESULTADO DA AUDITORIA SSP-GO: ${passed}/${passed + failed} TESTES APROVADOS`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error(`ERRO: ${failed} testes falharam na auditoria do adapter SSP-GO.`);
    process.exit(1);
  } else {
    console.log('TODAS AS ASSERÇÕES DO ADAPTER SSP-GO FORAM VALIDADAS COM 100% DE SUCESSO!');
    process.exit(0);
  }
}

runSspGoAudit().catch(err => {
  console.error("Falha fatal na execução da auditoria SSP-GO:", err);
  process.exit(1);
});
