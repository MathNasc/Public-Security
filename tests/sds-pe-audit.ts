import { SdsPeAdapter } from '../src/ingestion/adapters/sds-pe/SdsPeAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators, geographicMunicipalities } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSdsPeAudit() {
  console.log("================================================================================");
  console.log("       AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SDS-PE (PERNAMBUCO)            ");
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

  // 0. Assegurar Fonte SDS-PE e Municípios Principais de Pernambuco no Banco de Dados
  const peSource = await db.select().from(dataSources).where(sql`lower(id) = 'sds-pe'`);
  if (peSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SDS-PE',
      name: 'Secretaria de Defesa Social do Estado de Pernambuco',
      provider: 'SDS-PE',
      coverage: 'PE',
      state: 'PE',
      sourceType: 'csv',
      url: 'https://www.sds.pe.gov.br/estatisticas',
      officialUrl: 'https://www.sds.pe.gov.br/',
      documentationUrl: 'https://dados.pe.gov.br/',
      description: 'Estatísticas criminais, CVLI e CVP consolidados pela GGACE para os 185 municípios e Fernando de Noronha.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Assegura municípios de PE em geographic_municipalities
  const peMunis = [
    { code: '2611606', stateAcronym: 'PE', stateName: 'Pernambuco', name: 'Recife', normalizedName: 'recife', latitude: -8.0476, longitude: -34.8770 },
    { code: '2607901', stateAcronym: 'PE', stateName: 'Pernambuco', name: 'Jaboatão dos Guararapes', normalizedName: 'jaboatao dos guararapes', latitude: -8.1130, longitude: -35.0150 },
    { code: '2609600', stateAcronym: 'PE', stateName: 'Pernambuco', name: 'Olinda', normalizedName: 'olinda', latitude: -7.9984, longitude: -34.8456 },
    { code: '2604106', stateAcronym: 'PE', stateName: 'Pernambuco', name: 'Caruaru', normalizedName: 'caruaru', latitude: -8.2838, longitude: -35.9754 },
    { code: '2611101', stateAcronym: 'PE', stateName: 'Pernambuco', name: 'Petrolina', normalizedName: 'petrolina', latitude: -9.3888, longitude: -40.5027 },
    { code: '2610707', stateAcronym: 'PE', stateName: 'Pernambuco', name: 'Paulista', normalizedName: 'paulista', latitude: -7.9408, longitude: -34.8728 },
    { code: '2602902', stateAcronym: 'PE', stateName: 'Pernambuco', name: 'Cabo de Santo Agostinho', normalizedName: 'cabo de santo agostinho', latitude: -8.2811, longitude: -35.0344 },
    { code: '2603454', stateAcronym: 'PE', stateName: 'Pernambuco', name: 'Camaragibe', normalizedName: 'camaragibe', latitude: -8.0203, longitude: -34.9814 },
    { code: '2606002', stateAcronym: 'PE', stateName: 'Pernambuco', name: 'Garanhuns', normalizedName: 'garanhuns', latitude: -8.8907, longitude: -36.4928 },
    { code: '2616407', stateAcronym: 'PE', stateName: 'Pernambuco', name: 'Vitória de Santo Antão', normalizedName: 'vitoria de santo antao', latitude: -8.1189, longitude: -35.2928 },
    { code: '2606804', stateAcronym: 'PE', stateName: 'Pernambuco', name: 'Igarassu', normalizedName: 'igarassu', latitude: -7.8342, longitude: -34.9064 },
    { code: '2613701', stateAcronym: 'PE', stateName: 'Pernambuco', name: 'São Lourenço da Mata', normalizedName: 'sao lourenco da mata', latitude: -8.0022, longitude: -35.0189 },
    { code: '2613909', stateAcronym: 'PE', stateName: 'Pernambuco', name: 'Santa Cruz do Capibaribe', normalizedName: 'santa cruz do capibaribe', latitude: -7.9458, longitude: -36.2053 },
    { code: '2605459', stateAcronym: 'PE', stateName: 'Pernambuco', name: 'Fernando de Noronha', normalizedName: 'fernando de noronha', latitude: -3.8547, longitude: -32.4297 }
  ];

  for (const muni of peMunis) {
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

  const adapter = new SdsPeAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SDS-PE' && meta.coverage === 'PE' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do estado de Pernambuco");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SDS-PE' && discovery.url.includes('estatisticas'), "3. Discovery oficial apontando para repositório da SDS-PE");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'cvli', 'homicidio_doloso', 'cvp', 'cvp_veiculo', 'furto_veiculo', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial (Padrão SDS-PE)");

  const verticalHeaders = ['codigo_ibge', 'municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_PE_A', 'COLUNA_DESCONHECIDA_PE_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '2611606',
    municipio: 'Recife',
    ano: '2024',
    mes: '1',
    cvli: '45',
    homicidio_doloso: '40',
    latrocinio: '2',
    feminicidio: '2',
    lesao_morte: '1',
    cvp: '850',
    cvp_veiculo: '165',
    furto_veiculo: '92',
    cvp_coletivo: '38',
    cvp_comercio: '120',
    cvp_transeunte: '532',
    furto: '980',
    estupro: '32',
    trafico_drogas: '150',
    apreensao_armas: '68'
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

  assert(recHomicide?.data.value === 45 && recHomicide?.data.period === '2024-01', "8. Mapeamento Wide: CVLI Total (45 vítimas, 2024-01)");
  assert(recVehRob?.data.value === 165 && recVehRob?.data.category === 'vehicle_robbery', "9. Mapeamento Canônico de CVP Veículo / Roubo (165 ocorrências)");
  assert(recVehTheft?.data.value === 92 && recVehTheft?.data.category === 'vehicle_theft', "10. Mapeamento Canônico de Furto de Veículo (92 ocorrências)");
  assert(recRobbery?.data.value === 850 && recRobbery?.data.category === 'robbery', "11. Mapeamento Canônico de CVP Total (850 ocorrências)");
  assert(recTheft?.data.value === 980 && recTheft?.data.category === 'theft', "12. Mapeamento Canônico de Furto Geral (980 ocorrências)");
  assert(recSexual?.data.value === 32 && recSexual?.data.category === 'sexual_crime', "13. Mapeamento Canônico de Crimes Sexuais (32 vítimas)");
  assert(recDrugs?.data.value === 150 && recDrugs?.data.category === 'drug_related', "14. Mapeamento Canônico de Tráfico de Drogas (150 ocorrências)");
  assert(recArms?.data.value === 68 && recArms?.data.unit === 'armas', "15. Mapeamento Canônico de Apreensão de Armas (68 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    codigo_ibge: '2604106',
    municipio: 'Caruaru',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'CVLI',
    quantidade: '18'
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
  assert(adapter.mapCrimeToCanonical('CVP Veículo') === 'vehicle_robbery', "24. Taxonomia: CVP Veículo -> vehicle_robbery");
  assert(adapter.mapCrimeToCanonical('Roubo de Veículo') === 'vehicle_robbery', "25. Taxonomia: Roubo de Veículo -> vehicle_robbery");
  assert(adapter.mapCrimeToCanonical('Furto de Veículo') === 'vehicle_theft', "26. Taxonomia: Furto de Veículo -> vehicle_theft");
  assert(adapter.mapCrimeToCanonical('CVP Coletivo') === 'robbery', "27. Taxonomia: CVP Coletivo -> robbery");
  assert(adapter.mapCrimeToCanonical('CVP Transeunte') === 'robbery', "28. Taxonomia: CVP Transeunte -> robbery");
  assert(adapter.mapCrimeToCanonical('CVP Carga') === 'cargo_theft', "29. Taxonomia: CVP Carga -> cargo_theft");
  assert(adapter.mapCrimeToCanonical('Estupro') === 'sexual_crime', "30. Taxonomia: Estupro -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Tráfico de Drogas') === 'drug_related', "31. Taxonomia: Tráfico de Drogas -> drug_related");
  assert(adapter.mapCrimeToCanonical('Delito Desconhecido') === 'other', "32. Taxonomia: Fallback seguro para other");

  // 6. Normalização Geoespacial de Municípios e Aliases de Pernambuco
  const normRec = GeoNormalizationService.canonicalizeMunicipalityName('Rec');
  const normJaboatao = GeoNormalizationService.canonicalizeMunicipalityName('Jaboatão');
  const normCabo = GeoNormalizationService.canonicalizeMunicipalityName('Cabo');
  const normVitoria = GeoNormalizationService.canonicalizeMunicipalityName('Vitória de Sto Antão');
  const normStaCruz = GeoNormalizationService.canonicalizeMunicipalityName('Sta Cruz do Capibaribe');
  const normNoronha = GeoNormalizationService.canonicalizeMunicipalityName('Ilha de Fernando de Noronha');
  assert(normRec === 'recife', "33. Normalização de alias 'Rec' -> 'recife'");
  assert(normJaboatao === 'jaboatao dos guararapes', "34. Normalização de alias 'Jaboatão' -> 'jaboatao dos guararapes'");
  assert(normCabo === 'cabo de santo agostinho', "35. Normalização de alias 'Cabo' -> 'cabo de santo agostinho'");
  assert(normVitoria === 'vitoria de santo antao', "36. Normalização de alias 'Vitória de Sto Antão' -> 'vitoria de santo antao'");
  assert(normStaCruz === 'santa cruz do capibaribe', "37. Normalização de alias 'Sta Cruz do Capibaribe' -> 'santa cruz do capibaribe'");
  assert(normNoronha === 'fernando de noronha', "38. Normalização de alias 'Ilha de Fernando de Noronha' -> 'fernando de noronha'");

  // 7. Teste End-to-End no Pipeline com Fixture Real de Pernambuco
  console.log("\n--- TESTE END-TO-END: PIPELINE COMPLETO COM FIXTURE DE PERNAMBUCO ---");
  const peFixturePath = path.resolve('tests/fixtures/sds-pe/sds_pe_municipios_wide_real.csv');
  const peStream = fs.createReadStream(peFixturePath);

  // Armazenamento RAW Imutável
  const storedPe = await rawStorage.put('sds-pe', `audit_${Date.now()}`, 'sds_pe_municipios_wide_real.csv', peStream);
  assert(fs.existsSync(storedPe.path) && storedPe.metadata.size > 0, "39. Armazenamento RAW da fonte SDS-PE com SHA-256 e bytes calculados");

  // Criação de Job de Ingestão via JobManager
  const jobResult = await JobManager.createJob({
    sourceId: 'SDS-PE',
    datasetId: 'indicadores_municipais_pe',
    rawFilePath: storedPe.path,
    originalFilename: 'sds_pe_municipios_wide_real.csv',
    checksum: storedPe.metadata.checksum,
    fileSize: storedPe.metadata.size,
    force: true,
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });
  assert(!!jobResult && !!jobResult.jobId, "40. Criação e agendamento de Job de Ingestão para SDS-PE");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "41. Job persistido no banco com status QUEUED");

  // Execução pelo IngestionWorker
  const worker = new IngestionWorker('sds-pe-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "42. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 14, `43. 14 municípios pernambucanos processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 112, `44. 112 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Verificação de Persistência no Banco de Dados
  const indicatorsInDb = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SDS-PE'));

  assert(indicatorsInDb.length === 112, `45. Exatamente 112 indicadores de Pernambuco persistidos no banco (${indicatorsInDb.length} registros)`);

  const recifeHomicides = indicatorsInDb.find(i => 
    i.municipalityCode === '2611606' && 
    i.category === 'homicide' && 
    i.period === '2024-01'
  );
  assert(recifeHomicides?.value === 45, "46. Registro validado com precisão: Recife Jan/2024 CVLI/Homicídio = 45");

  const caruaruCvp = indicatorsInDb.find(i => 
    i.municipalityCode === '2604106' && 
    i.category === 'robbery' && 
    i.period === '2024-01'
  );
  assert(caruaruCvp?.value === 210, "47. Registro validado com precisão: Caruaru Jan/2024 CVP/Roubo = 210");

  // 9. Teste de Idempotência e Reprocessamento
  console.log("\n--- TESTE DE IDEMPOTÊNCIA E REPROCESSAMENTO ---");
  const countBeforeReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SDS-PE'));

  const reprocessJob = await JobManager.reprocessJob(jobResult.jobId);
  assert(reprocessJob.success && !!reprocessJob.jobId, "48. Agendamento de reprocessamento a partir do RAW preservado");

  const [dbReprocessJob] = await db.select().from(dataImports).where(eq(dataImports.id, reprocessJob.jobId));
  const reprocessResult = await worker.processJobDirectly(dbReprocessJob);
  assert(reprocessResult.success, "49. IngestionWorker conclui reprocessamento com sucesso");

  const countAfterReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SDS-PE'));

  assert(
    Number(countBeforeReprocess[0].count) === Number(countAfterReprocess[0].count),
    "50. Idempotência absoluta garantida: contagem de indicadores não duplica nem se altera após reprocessamento"
  );

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`  RESULTADO DA AUDITORIA SDS-PE: ${passed}/${passed + failed} TESTES APROVADOS`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error(`ERRO: ${failed} testes falharam na auditoria do adapter SDS-PE.`);
    process.exit(1);
  } else {
    console.log('TODAS AS ASSERÇÕES DO ADAPTER SDS-PE FORAM VALIDADAS COM 100% DE SUCESSO!');
    process.exit(0);
  }
}

runSdsPeAudit().catch(err => {
  console.error("Falha fatal na execução da auditoria SDS-PE:", err);
  process.exit(1);
});
