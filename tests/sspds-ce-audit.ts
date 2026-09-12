import { SspdsCeAdapter } from '../src/ingestion/adapters/sspds-ce/SspdsCeAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators, geographicMunicipalities } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSspdsCeAudit() {
  console.log("================================================================================");
  console.log("       AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SSPDS-CE (CEARÁ)               ");
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

  // 0. Assegurar Fonte SSPDS-CE e Municípios Principais do Ceará no Banco de Dados
  const ceSource = await db.select().from(dataSources).where(sql`lower(id) = 'sspds-ce'`);
  if (ceSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SSPDS-CE',
      name: 'Secretaria da Segurança Pública e Defesa Social do Estado do Ceará',
      provider: 'SSPDS-CE',
      coverage: 'CE',
      state: 'CE',
      sourceType: 'csv',
      url: 'https://www.sspds.ce.gov.br/estatisticas-2',
      officialUrl: 'https://www.sspds.ce.gov.br/',
      documentationUrl: 'https://supesp.ce.gov.br/',
      description: 'Estatísticas criminais, CVLI e CVP consolidados pela SUPESP/GEESP para os 184 municípios do Ceará.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Assegura municípios do CE em geographic_municipalities
  const ceMunis = [
    { code: '2304400', stateAcronym: 'CE', stateName: 'Ceará', name: 'Fortaleza', normalizedName: 'fortaleza', latitude: -3.7319, longitude: -38.5267 },
    { code: '2303709', stateAcronym: 'CE', stateName: 'Ceará', name: 'Caucaia', normalizedName: 'caucaia', latitude: -3.7323, longitude: -38.6531 },
    { code: '2307304', stateAcronym: 'CE', stateName: 'Ceará', name: 'Juazeiro do Norte', normalizedName: 'juazeiro do norte', latitude: -7.2131, longitude: -39.3153 },
    { code: '2307700', stateAcronym: 'CE', stateName: 'Ceará', name: 'Maracanaú', normalizedName: 'maracanau', latitude: -3.8767, longitude: -38.6256 },
    { code: '2312908', stateAcronym: 'CE', stateName: 'Ceará', name: 'Sobral', normalizedName: 'sobral', latitude: -3.6894, longitude: -40.3486 },
    { code: '2304103', stateAcronym: 'CE', stateName: 'Ceará', name: 'Crato', normalizedName: 'crato', latitude: -7.2342, longitude: -39.4094 },
    { code: '2306405', stateAcronym: 'CE', stateName: 'Ceará', name: 'Itapipoca', normalizedName: 'itapipoca', latitude: -3.4944, longitude: -39.5789 },
    { code: '2307650', stateAcronym: 'CE', stateName: 'Ceará', name: 'Maranguape', normalizedName: 'maranguape', latitude: -3.8911, longitude: -38.6861 },
    { code: '2305233', stateAcronym: 'CE', stateName: 'Ceará', name: 'Eusébio', normalizedName: 'eusebio', latitude: -3.8897, longitude: -38.4528 },
    { code: '2305506', stateAcronym: 'CE', stateName: 'Ceará', name: 'Iguatu', normalizedName: 'iguatu', latitude: -6.3597, longitude: -39.2961 },
    { code: '2311306', stateAcronym: 'CE', stateName: 'Ceará', name: 'Quixadá', normalizedName: 'quixada', latitude: -4.9714, longitude: -39.0153 },
    { code: '2309706', stateAcronym: 'CE', stateName: 'Ceará', name: 'Pacatuba', normalizedName: 'pacatuba', latitude: -3.9842, longitude: -38.6186 },
    { code: '2301000', stateAcronym: 'CE', stateName: 'Ceará', name: 'Aquiraz', normalizedName: 'aquiraz', latitude: -3.9014, longitude: -38.3911 },
    { code: '2311405', stateAcronym: 'CE', stateName: 'Ceará', name: 'Quixeramobim', normalizedName: 'quixeramobim', latitude: -5.1978, longitude: -39.2936 }
  ];

  for (const muni of ceMunis) {
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

  const adapter = new SspdsCeAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SSPDS-CE' && meta.coverage === 'CE' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do estado do Ceará");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SSPDS-CE' && discovery.url.includes('estatisticas'), "3. Discovery oficial apontando para repositório da SSPDS-CE");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'cvli', 'homicidio_doloso', 'cvp', 'cvp_veiculo', 'furto_veiculo', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial (Padrão SSPDS-CE)");

  const verticalHeaders = ['codigo_ibge', 'municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_CE_A', 'COLUNA_DESCONHECIDA_CE_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '2304400',
    municipio: 'Fortaleza',
    ano: '2024',
    mes: '1',
    cvli: '62',
    homicidio_doloso: '56',
    latrocinio: '3',
    feminicidio: '2',
    lesao_morte: '1',
    cvp: '1420',
    cvp_veiculo: '285',
    furto_veiculo: '140',
    cvp_coletivo: '54',
    cvp_comercio: '180',
    cvp_transeunte: '941',
    furto: '1650',
    estupro: '48',
    trafico_drogas: '220',
    apreensao_armas: '115'
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

  assert(recHomicide?.data.value === 62 && recHomicide?.data.period === '2024-01', "8. Mapeamento Wide: CVLI Total (62 vítimas, 2024-01)");
  assert(recVehRob?.data.value === 285 && recVehRob?.data.category === 'vehicle_robbery', "9. Mapeamento Canônico de CVP Veículo / Roubo (285 ocorrências)");
  assert(recVehTheft?.data.value === 140 && recVehTheft?.data.category === 'vehicle_theft', "10. Mapeamento Canônico de Furto de Veículo (140 ocorrências)");
  assert(recRobbery?.data.value === 1420 && recRobbery?.data.category === 'robbery', "11. Mapeamento Canônico de CVP Total (1420 ocorrências)");
  assert(recTheft?.data.value === 1650 && recTheft?.data.category === 'theft', "12. Mapeamento Canônico de Furto Geral (1650 ocorrências)");
  assert(recSexual?.data.value === 48 && recSexual?.data.category === 'sexual_crime', "13. Mapeamento Canônico de Crimes Sexuais (48 vítimas)");
  assert(recDrugs?.data.value === 220 && recDrugs?.data.category === 'drug_related', "14. Mapeamento Canônico de Tráfico de Drogas (220 ocorrências)");
  assert(recArms?.data.value === 115 && recArms?.data.unit === 'armas', "15. Mapeamento Canônico de Apreensão de Armas (115 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    codigo_ibge: '2307304',
    municipio: 'Juazeiro do Norte',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'CVLI',
    quantidade: '16'
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
  assert(adapter.mapCrimeToCanonical('Roubo a Pessoa') === 'robbery', "28. Taxonomia: Roubo a Pessoa -> robbery");
  assert(adapter.mapCrimeToCanonical('CVP Carga') === 'cargo_theft', "29. Taxonomia: CVP Carga -> cargo_theft");
  assert(adapter.mapCrimeToCanonical('Estupro') === 'sexual_crime', "30. Taxonomia: Estupro -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Tráfico de Drogas') === 'drug_related', "31. Taxonomia: Tráfico de Drogas -> drug_related");
  assert(adapter.mapCrimeToCanonical('Delito Desconhecido') === 'other', "32. Taxonomia: Fallback seguro para other");

  // 6. Normalização Geoespacial de Municípios e Aliases do Ceará
  const normFortal = GeoNormalizationService.canonicalizeMunicipalityName('Fortal');
  const normJuazeiro = GeoNormalizationService.canonicalizeMunicipalityName('Juazeiro N');
  const normSGoncalo = GeoNormalizationService.canonicalizeMunicipalityName('S. Goncalo do Amarante');
  const normSBenedito = GeoNormalizationService.canonicalizeMunicipalityName('S. Benedito');
  const normStaQuiteria = GeoNormalizationService.canonicalizeMunicipalityName('Sta Quiteria');
  const normLimoeiro = GeoNormalizationService.canonicalizeMunicipalityName('Limoeiro');
  assert(normFortal === 'fortaleza', "33. Normalização de alias 'Fortal' -> 'fortaleza'");
  assert(normJuazeiro === 'juazeiro do norte', "34. Normalização de alias 'Juazeiro N' -> 'juazeiro do norte'");
  assert(normSGoncalo === 'sao goncalo do amarante', "35. Normalização de alias 'S. Goncalo do Amarante' -> 'sao goncalo do amarante'");
  assert(normSBenedito === 'sao benedito', "36. Normalização de alias 'S. Benedito' -> 'sao benedito'");
  assert(normStaQuiteria === 'santa quiteria', "37. Normalização de alias 'Sta Quiteria' -> 'santa quiteria'");
  assert(normLimoeiro === 'limoeiro do norte', "38. Normalização de alias 'Limoeiro' -> 'limoeiro do norte'");

  // 7. Teste End-to-End no Pipeline com Fixture Real do Ceará
  console.log("\n--- TESTE END-TO-END: PIPELINE COMPLETO COM FIXTURE DO CEARÁ ---");
  const ceFixturePath = path.resolve('tests/fixtures/sspds-ce/sspds_ce_municipios_wide_real.csv');
  const ceStream = fs.createReadStream(ceFixturePath);

  // Armazenamento RAW Imutável
  const storedCe = await rawStorage.put('sspds-ce', `audit_${Date.now()}`, 'sspds_ce_municipios_wide_real.csv', ceStream);
  assert(fs.existsSync(storedCe.path) && storedCe.metadata.size > 0, "39. Armazenamento RAW da fonte SSPDS-CE com SHA-256 e bytes calculados");

  // Criação de Job de Ingestão via JobManager
  const jobResult = await JobManager.createJob({
    sourceId: 'SSPDS-CE',
    datasetId: 'indicadores_municipais_ce',
    rawFilePath: storedCe.path,
    originalFilename: 'sspds_ce_municipios_wide_real.csv',
    checksum: storedCe.metadata.checksum,
    fileSize: storedCe.metadata.size,
    force: true,
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });
  assert(!!jobResult && !!jobResult.jobId, "40. Criação e agendamento de Job de Ingestão para SSPDS-CE");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "41. Job persistido no banco com status QUEUED");

  // Execução pelo IngestionWorker
  const worker = new IngestionWorker('sspds-ce-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "42. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 14, `43. 14 municípios cearenses processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 112, `44. 112 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Verificação de Persistência no Banco de Dados
  const indicatorsInDb = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSPDS-CE'));

  assert(indicatorsInDb.length === 112, `45. Exatamente 112 indicadores do Ceará persistidos no banco (${indicatorsInDb.length} registros)`);

  const fortalezaHomicides = indicatorsInDb.find(i => 
    i.municipalityCode === '2304400' && 
    i.category === 'homicide' && 
    i.period === '2024-01'
  );
  assert(fortalezaHomicides?.value === 62, "46. Registro validado com precisão: Fortaleza Jan/2024 CVLI/Homicídio = 62");

  const juazeiroCvp = indicatorsInDb.find(i => 
    i.municipalityCode === '2307304' && 
    i.category === 'robbery' && 
    i.period === '2024-01'
  );
  assert(juazeiroCvp?.value === 185, "47. Registro validado com precisão: Juazeiro do Norte Jan/2024 CVP/Roubo = 185");

  // 9. Teste de Idempotência e Reprocessamento
  console.log("\n--- TESTE DE IDEMPOTÊNCIA E REPROCESSAMENTO ---");
  const countBeforeReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSPDS-CE'));

  const reprocessJob = await JobManager.reprocessJob(jobResult.jobId);
  assert(reprocessJob.success && !!reprocessJob.jobId, "48. Agendamento de reprocessamento a partir do RAW preservado");

  const [dbReprocessJob] = await db.select().from(dataImports).where(eq(dataImports.id, reprocessJob.jobId));
  const reprocessResult = await worker.processJobDirectly(dbReprocessJob);
  assert(reprocessResult.success, "49. IngestionWorker conclui reprocessamento com sucesso");

  const countAfterReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSPDS-CE'));

  assert(
    Number(countBeforeReprocess[0].count) === Number(countAfterReprocess[0].count),
    "50. Idempotência absoluta garantida: contagem de indicadores não duplica nem se altera após reprocessamento"
  );

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`  RESULTADO DA AUDITORIA SSPDS-CE: ${passed}/${passed + failed} TESTES APROVADOS`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error(`ERRO: ${failed} testes falharam na auditoria do adapter SSPDS-CE.`);
    process.exit(1);
  } else {
    console.log('TODAS AS ASSERÇÕES DO ADAPTER SSPDS-CE FORAM VALIDADAS COM 100% DE SUCESSO!');
    process.exit(0);
  }
}

runSspdsCeAudit().catch(err => {
  console.error("Falha fatal na execução da auditoria SSPDS-CE:", err);
  process.exit(1);
});
