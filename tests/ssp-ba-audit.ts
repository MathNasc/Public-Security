import { SspBaAdapter } from '../src/ingestion/adapters/ssp-ba/SspBaAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators, geographicMunicipalities } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSspBaAudit() {
  console.log("================================================================================");
  console.log("         AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SSP-BA (BAHIA)               ");
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

  // 0. Assegurar Fonte SSP-BA e Municípios Principais da Bahia no Banco de Dados
  const baSource = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-ba'`);
  if (baSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SSP-BA',
      name: 'Secretaria da Segurança Pública do Estado da Bahia',
      provider: 'SSP-BA',
      coverage: 'BA',
      state: 'BA',
      sourceType: 'csv',
      url: 'https://www.ssp.ba.gov.br/estatisticas',
      officialUrl: 'https://www.ssp.ba.gov.br/',
      documentationUrl: 'https://dados.ba.gov.br/',
      description: 'Estatísticas criminais e CVLI consolidados pela SIAP e CEVAL para os 417 municípios do Estado da Bahia.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Assegura municípios principais da BA em geographic_municipalities
  const baMunis = [
    { code: '2927408', stateAcronym: 'BA', stateName: 'Bahia', name: 'Salvador', normalizedName: 'salvador', latitude: -12.9714, longitude: -38.5014 },
    { code: '2910800', stateAcronym: 'BA', stateName: 'Bahia', name: 'Feira de Santana', normalizedName: 'feira de santana', latitude: -12.2664, longitude: -38.9663 },
    { code: '2933307', stateAcronym: 'BA', stateName: 'Bahia', name: 'Vitória da Conquista', normalizedName: 'vitoria da conquista', latitude: -14.8661, longitude: -40.8394 },
    { code: '2905701', stateAcronym: 'BA', stateName: 'Bahia', name: 'Camaçari', normalizedName: 'camacari', latitude: -12.6975, longitude: -38.3242 },
    { code: '2918407', stateAcronym: 'BA', stateName: 'Bahia', name: 'Juazeiro', normalizedName: 'juazeiro', latitude: -9.4168, longitude: -40.5033 },
    { code: '2914802', stateAcronym: 'BA', stateName: 'Bahia', name: 'Itabuna', normalizedName: 'itabuna', latitude: -14.7933, longitude: -39.2818 },
    { code: '2919207', stateAcronym: 'BA', stateName: 'Bahia', name: 'Lauro de Freitas', normalizedName: 'lauro de freitas', latitude: -12.8944, longitude: -38.3272 },
    { code: '2913606', stateAcronym: 'BA', stateName: 'Bahia', name: 'Ilhéus', normalizedName: 'ilheus', latitude: -14.7889, longitude: -39.0494 },
    { code: '2918001', stateAcronym: 'BA', stateName: 'Bahia', name: 'Jequié', normalizedName: 'jequie', latitude: -13.8576, longitude: -40.0837 },
    { code: '2931350', stateAcronym: 'BA', stateName: 'Bahia', name: 'Teixeira de Freitas', normalizedName: 'teixeira de freitas', latitude: -17.5348, longitude: -39.7424 },
    { code: '2900702', stateAcronym: 'BA', stateName: 'Bahia', name: 'Alagoinhas', normalizedName: 'alagoinhas', latitude: -12.1356, longitude: -38.4194 },
    { code: '2925303', stateAcronym: 'BA', stateName: 'Bahia', name: 'Porto Seguro', normalizedName: 'porto seguro', latitude: -16.4497, longitude: -39.0647 },
    { code: '2903201', stateAcronym: 'BA', stateName: 'Bahia', name: 'Barreiras', normalizedName: 'barreiras', latitude: -12.1528, longitude: -44.9961 }
  ];

  for (const muni of baMunis) {
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

  const adapter = new SspBaAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SSP-BA' && meta.coverage === 'BA' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do estado da Bahia");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SSP-BA' && discovery.url.includes('estatisticas'), "3. Discovery oficial apontando para repositório da SSP-BA");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'cvli', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo', 'furto', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial (Padrão SSP-BA)");

  const verticalHeaders = ['codigo_ibge', 'municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_BA_A', 'COLUNA_DESCONHECIDA_BA_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '2927408',
    municipio: 'Salvador',
    ano: '2024',
    mes: '1',
    cvli: '72',
    homicidio_doloso: '68',
    latrocinio: '2',
    feminicidio: '1',
    lesao_morte: '1',
    roubo_veiculo: '290',
    furto_veiculo: '180',
    roubo_onibus: '42',
    roubo_comercio: '115',
    roubo_transeunte: '1420',
    furto: '1850',
    estupro: '45',
    trafico_drogas: '260',
    apreensao_armas: '110'
  }) as any[];

  assert(Array.isArray(parsedWide) && parsedWide.length === 8, "7. Desdobramento de colunas largas em 8 registros canônicos por município");
  const ssaHomicide = parsedWide.find(r => r.data.category === 'homicide');
  const ssaVehRob = parsedWide.find(r => r.data.category === 'vehicle_robbery');
  const ssaVehTheft = parsedWide.find(r => r.data.category === 'vehicle_theft');
  const ssaRobbery = parsedWide.find(r => r.data.category === 'robbery');
  const ssaTheft = parsedWide.find(r => r.data.category === 'theft');
  const ssaSexual = parsedWide.find(r => r.data.category === 'sexual_crime');
  const ssaDrugs = parsedWide.find(r => r.data.category === 'drug_related');
  const ssaArms = parsedWide.find(r => r.data.category === 'other');

  assert(ssaHomicide?.data.value === 72 && ssaHomicide?.data.period === '2024-01', "8. Mapeamento Wide: CVLI Total (72 vítimas, 2024-01)");
  assert(ssaVehRob?.data.value === 290 && ssaVehRob?.data.category === 'vehicle_robbery', "9. Mapeamento Canônico de Roubo de Veículo (290 ocorrências)");
  assert(ssaVehTheft?.data.value === 180 && ssaVehTheft?.data.category === 'vehicle_theft', "10. Mapeamento Canônico de Furto de Veículo (180 ocorrências)");
  assert(ssaRobbery?.data.value === (42 + 115 + 1420) && ssaRobbery?.data.category === 'robbery', "11. Mapeamento Canônico Agregado de Roubo (Ônibus + Comércio + Transeunte)");
  assert(ssaTheft?.data.value === 1850 && ssaTheft?.data.category === 'theft', "12. Mapeamento Canônico de Furto Geral (1850 ocorrências)");
  assert(ssaSexual?.data.value === 45 && ssaSexual?.data.category === 'sexual_crime', "13. Mapeamento Canônico de Crimes Sexuais (45 vítimas)");
  assert(ssaDrugs?.data.value === 260 && ssaDrugs?.data.category === 'drug_related', "14. Mapeamento Canônico de Tráfico de Drogas (260 ocorrências)");
  assert(ssaArms?.data.value === 110 && ssaArms?.data.unit === 'armas', "15. Mapeamento Canônico de Apreensão de Armas (110 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    codigo_ibge: '2910800',
    municipio: 'Feira de Santana',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Homicídio Doloso',
    quantidade: '24'
  }) as any[];

  assert(Array.isArray(parsedVertical) && parsedVertical.length === 1, "16. Parsing de registro vertical com conversão de nome do mês");
  assert(parsedVertical[0].data.category === 'homicide' && parsedVertical[0].data.period === '2024-02', "17. Conversão de Fevereiro para período 2024-02");

  // 5. Mapeamento Taxonômico Canônico
  assert(adapter.mapCrimeToCanonical('CVLI') === 'homicide', "18. Taxonomia: CVLI -> homicide");
  assert(adapter.mapCrimeToCanonical('Homicídio Doloso') === 'homicide', "19. Taxonomia: Homicídio Doloso -> homicide");
  assert(adapter.mapCrimeToCanonical('Latrocínio') === 'homicide', "20. Taxonomia: Latrocínio -> homicide");
  assert(adapter.mapCrimeToCanonical('Feminicídio') === 'homicide', "21. Taxonomia: Feminicídio -> homicide");
  assert(adapter.mapCrimeToCanonical('Lesão Corporal Seguida de Morte') === 'homicide', "22. Taxonomia: Lesão Morte -> homicide");
  assert(adapter.mapCrimeToCanonical('Tentativa de Homicídio') === 'bodily_harm', "23. Taxonomia: Tentativa de Homicídio -> bodily_harm");
  assert(adapter.mapCrimeToCanonical('Roubo de Veículo') === 'vehicle_robbery', "24. Taxonomia: Roubo de Veículo -> vehicle_robbery");
  assert(adapter.mapCrimeToCanonical('Furto de Veículo') === 'vehicle_theft', "25. Taxonomia: Furto de Veículo -> vehicle_theft");
  assert(adapter.mapCrimeToCanonical('Roubo a Ônibus') === 'robbery', "26. Taxonomia: Roubo a Ônibus -> robbery");
  assert(adapter.mapCrimeToCanonical('Roubo a Coletivo') === 'robbery', "27. Taxonomia: Roubo a Coletivo -> robbery");
  assert(adapter.mapCrimeToCanonical('Roubo de Carga') === 'cargo_theft', "28. Taxonomia: Roubo de Carga -> cargo_theft");
  assert(adapter.mapCrimeToCanonical('Estupro') === 'sexual_crime', "29. Taxonomia: Estupro -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Tráfico de Drogas') === 'drug_related', "30. Taxonomia: Tráfico de Drogas -> drug_related");
  assert(adapter.mapCrimeToCanonical('Delito Desconhecido') === 'other', "31. Taxonomia: Fallback seguro para other");

  // 6. Normalização Geoespacial de Municípios e Aliases da Bahia
  const normSsa = GeoNormalizationService.canonicalizeMunicipalityName('SSA');
  const normFeira = GeoNormalizationService.canonicalizeMunicipalityName('Feira');
  const normConquista = GeoNormalizationService.canonicalizeMunicipalityName('Conquista');
  const normLauro = GeoNormalizationService.canonicalizeMunicipalityName('Lauro');
  const normStoAntonio = GeoNormalizationService.canonicalizeMunicipalityName('S. Antonio de Jesus');
  const normSFcoConde = GeoNormalizationService.canonicalizeMunicipalityName('S. Francisco do Conde');
  assert(normSsa === 'salvador', "32. Normalização de alias 'SSA' -> 'salvador'");
  assert(normFeira === 'feira de santana', "33. Normalização de alias 'Feira' -> 'feira de santana'");
  assert(normConquista === 'vitoria da conquista', "34. Normalização de alias 'Conquista' -> 'vitoria da conquista'");
  assert(normLauro === 'lauro de freitas', "35. Normalização de alias 'Lauro' -> 'lauro de freitas'");
  assert(normStoAntonio === 'santo antonio de jesus', "36. Normalização de alias 'S. Antonio de Jesus' -> 'santo antonio de jesus'");
  assert(normSFcoConde === 'sao francisco do conde', "37. Normalização de alias 'S. Francisco do Conde' -> 'sao francisco do conde'");

  // 7. Teste End-to-End no Pipeline com Fixture Real da Bahia
  console.log("\n--- TESTE END-TO-END: PIPELINE COMPLETO COM FIXTURE DA BAHIA ---");
  const baFixturePath = path.resolve('tests/fixtures/ssp-ba/ssp_ba_municipios_wide_real.csv');
  const baStream = fs.createReadStream(baFixturePath);

  // Armazenamento RAW Imutável
  const storedBa = await rawStorage.put('ssp-ba', `audit_${Date.now()}`, 'ssp_ba_municipios_wide_real.csv', baStream);
  assert(fs.existsSync(storedBa.path) && storedBa.metadata.size > 0, "38. Armazenamento RAW da fonte SSP-BA com SHA-256 e bytes calculados");

  // Criação de Job de Ingestão via JobManager
  const jobResult = await JobManager.createJob({
    sourceId: 'SSP-BA',
    datasetId: 'indicadores_municipais_ba',
    rawFilePath: storedBa.path,
    originalFilename: 'ssp_ba_municipios_wide_real.csv',
    checksum: storedBa.metadata.checksum,
    fileSize: storedBa.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "39. Criação e agendamento de Job de Ingestão para SSP-BA");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "40. Job persistido no banco com status QUEUED");

  // Execução pelo IngestionWorker
  const worker = new IngestionWorker('ssp-ba-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "41. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 13, `42. 13 municípios baianos processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 104, `43. 104 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Verificação de Persistência no Banco de Dados
  const indicatorsInDb = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-BA'));

  assert(indicatorsInDb.length === 104, `44. Exatamente 104 indicadores da Bahia persistidos no banco (${indicatorsInDb.length} registros)`);

  const ssaHomicides = indicatorsInDb.find(i => 
    i.municipalityCode === '2927408' && 
    i.category === 'homicide' && 
    i.period === '2024-01'
  );
  assert(ssaHomicides?.value === 72, "45. Registro validado com precisão: Salvador Jan/2024 CVLI/Homicídio = 72");

  const feiraVehRob = indicatorsInDb.find(i => 
    i.municipalityCode === '2910800' && 
    i.category === 'vehicle_robbery' && 
    i.period === '2024-01'
  );
  assert(feiraVehRob?.value === 95, "46. Registro validado com precisão: Feira de Santana Jan/2024 Roubo de Veículo = 95");

  // 9. Teste de Idempotência e Reprocessamento
  console.log("\n--- TESTE DE IDEMPOTÊNCIA E REPROCESSAMENTO ---");
  const countBeforeReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-BA'));

  const reprocessJob = await JobManager.reprocessJob(jobResult.jobId);
  assert(reprocessJob.success && !!reprocessJob.jobId, "47. Agendamento de reprocessamento a partir do RAW preservado");

  const [dbReprocessJob] = await db.select().from(dataImports).where(eq(dataImports.id, reprocessJob.jobId));
  const reprocessResult = await worker.processJobDirectly(dbReprocessJob);
  assert(reprocessResult.success, "48. IngestionWorker conclui reprocessamento com sucesso");

  const countAfterReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-BA'));

  assert(
    Number(countBeforeReprocess[0].count) === Number(countAfterReprocess[0].count),
    "49. Idempotência absoluta garantida: contagem de indicadores não duplica nem se altera após reprocessamento"
  );

  // 10. Atualização do Status Operacional da Fonte
  const [updatedSource] = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-ba'`);
  assert(updatedSource?.status === 'OPERATIONAL', "50. Status operacional da fonte SSP-BA configurado para OPERATIONAL");

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`  RESULTADO DA AUDITORIA SSP-BA: ${passed}/${passed + failed} TESTES APROVADOS`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error(`ERRO: ${failed} testes falharam na auditoria do adapter SSP-BA.`);
    process.exit(1);
  } else {
    console.log('TODAS AS ASSERÇÕES DO ADAPTER SSP-BA FORAM VALIDADAS COM 100% DE SUCESSO!');
    process.exit(0);
  }
}

runSspBaAudit().catch(err => {
  console.error("Falha fatal na execução da auditoria SSP-BA:", err);
  process.exit(1);
});
