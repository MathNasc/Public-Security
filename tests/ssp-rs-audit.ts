import { SspRsAdapter } from '../src/ingestion/adapters/ssp-rs/SspRsAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators, geographicMunicipalities } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSspRsAudit() {
  console.log("================================================================================");
  console.log("      AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SSP-RS (RIO GRANDE DO SUL)      ");
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

  // 0. Assegurar Fonte SSP-RS e Municípios Principais do RS no Banco de Dados
  const rsSource = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-rs'`);
  if (rsSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SSP-RS',
      name: 'Secretaria da Segurança Pública do Rio Grande do Sul',
      provider: 'SSP-RS',
      coverage: 'RS',
      state: 'RS',
      sourceType: 'csv',
      url: 'https://ssp.rs.gov.br/indicadores-criminais',
      officialUrl: 'https://ssp.rs.gov.br/',
      documentationUrl: 'https://dados.rs.gov.br/',
      description: 'Estatísticas e indicadores criminais consolidados mensalmente para os 497 municípios do Rio Grande do Sul.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Assegura municípios principais do RS em geographic_municipalities
  const rsMunis = [
    { code: '4314902', stateAcronym: 'RS', stateName: 'Rio Grande do Sul', name: 'Porto Alegre', normalizedName: 'porto alegre', latitude: -30.0346, longitude: -51.2177 },
    { code: '4305108', stateAcronym: 'RS', stateName: 'Rio Grande do Sul', name: 'Caxias do Sul', normalizedName: 'caxias do sul', latitude: -29.1678, longitude: -51.1794 },
    { code: '4314407', stateAcronym: 'RS', stateName: 'Rio Grande do Sul', name: 'Pelotas', normalizedName: 'pelotas', latitude: -31.7654, longitude: -52.3376 },
    { code: '4304606', stateAcronym: 'RS', stateName: 'Rio Grande do Sul', name: 'Canoas', normalizedName: 'canoas', latitude: -29.9178, longitude: -51.1836 },
    { code: '4316907', stateAcronym: 'RS', stateName: 'Rio Grande do Sul', name: 'Santa Maria', normalizedName: 'santa maria', latitude: -29.6842, longitude: -53.8069 },
    { code: '4309209', stateAcronym: 'RS', stateName: 'Rio Grande do Sul', name: 'Gravataí', normalizedName: 'gravatai', latitude: -29.9442, longitude: -50.9928 },
    { code: '4323002', stateAcronym: 'RS', stateName: 'Rio Grande do Sul', name: 'Viamão', normalizedName: 'viamao', latitude: -30.0811, longitude: -51.0233 },
    { code: '4313409', stateAcronym: 'RS', stateName: 'Rio Grande do Sul', name: 'Novo Hamburgo', normalizedName: 'novo hamburgo', latitude: -29.6783, longitude: -51.1306 },
    { code: '4318705', stateAcronym: 'RS', stateName: 'Rio Grande do Sul', name: 'São Leopoldo', normalizedName: 'sao leopoldo', latitude: -29.7547, longitude: -51.1469 },
    { code: '4315602', stateAcronym: 'RS', stateName: 'Rio Grande do Sul', name: 'Rio Grande', normalizedName: 'rio grande', latitude: -32.0350, longitude: -52.0986 },
    { code: '4314100', stateAcronym: 'RS', stateName: 'Rio Grande do Sul', name: 'Passo Fundo', normalizedName: 'passo fundo', latitude: -28.2612, longitude: -52.4083 }
  ];

  for (const muni of rsMunis) {
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

  const adapter = new SspRsAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SSP-RS' && meta.coverage === 'RS' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do estado do Rio Grande do Sul");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SSP-RS' && discovery.url.includes('indicadores-criminais'), "3. Discovery oficial apontando para repositório da SSP-RS");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo', 'furto'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial (Padrão SSP-RS)");

  const verticalHeaders = ['codigo_ibge', 'municipio', 'ano', 'mes', 'natureza', 'total'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical");

  const corruptedHeaders = ['CAMPO_ALEATORIO_X', 'CAMPO_ALEATORIO_Y'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Corrompido");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '4314902',
    municipio: 'Porto Alegre',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '22',
    latrocinio: '2',
    feminicidio: '1',
    roubo_veiculo: '180',
    furto_veiculo: '260',
    roubo: '1120',
    furto: '2150',
    estupro: '35',
    trafico_entorpecentes: '290',
    delitos_armas_municoes: '85'
  }) as any[];

  assert(Array.isArray(parsedWide) && parsedWide.length >= 8, "7. Desdobramento de colunas largas em múltiplos registros de indicadores");
  const poaHom = parsedWide.find(r => r.data.category === 'homicide' && r.data.subcategory === 'homicidio_doloso');
  const poaLat = parsedWide.find(r => r.data.category === 'homicide' && r.data.subcategory === 'latrocinio');
  const poaVehRob = parsedWide.find(r => r.data.category === 'vehicle_robbery');
  const poaVehTheft = parsedWide.find(r => r.data.category === 'vehicle_theft');
  const poaRobbery = parsedWide.find(r => r.data.category === 'robbery');
  const poaTheft = parsedWide.find(r => r.data.category === 'theft');
  const poaDrugs = parsedWide.find(r => r.data.category === 'drug_related');

  assert(poaHom?.data.value === 22 && poaHom?.data.period === '2024-01', "8. Mapeamento Wide: Homicídio Doloso (22 vítimas, 2024-01)");
  assert(poaLat?.data.value === 2 && poaLat?.data.category === 'homicide', "9. Mapeamento Canônico de Latrocínio para Homicide");
  assert(poaVehRob?.data.value === 180 && poaVehRob?.data.category === 'vehicle_robbery', "10. Mapeamento Canônico de Roubo de Veículo");
  assert(poaVehTheft?.data.value === 260 && poaVehTheft?.data.category === 'vehicle_theft', "11. Mapeamento Canônico de Furto de Veículo");
  assert(poaRobbery?.data.value === 1120 && poaRobbery?.data.category === 'robbery', "12. Mapeamento Canônico de Roubo Geral");
  assert(poaTheft?.data.value === 2150 && poaTheft?.data.category === 'theft', "13. Mapeamento Canônico de Furto Geral");
  assert(poaDrugs?.data.value === 290 && poaDrugs?.data.category === 'drug_related', "14. Mapeamento Canônico de Tráfico de Entorpecentes");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    codigo_ibge: '4305108',
    municipio: 'Caxias do Sul',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Homicídio Doloso',
    total: '7'
  }) as any[];

  assert(Array.isArray(parsedVertical) && parsedVertical.length === 1, "15. Parsing de registro vertical com conversão de nome do mês");
  assert(parsedVertical[0].data.category === 'homicide' && parsedVertical[0].data.period === '2024-02', "16. Conversão de Fevereiro para período 2024-02");

  // 5. Mapeamento Taxonômico Canônico
  assert(adapter.mapCrimeToCanonical('Homicídio Doloso') === 'homicide', "17. Taxonomia: Homicídio Doloso -> homicide");
  assert(adapter.mapCrimeToCanonical('Latrocínio') === 'homicide', "18. Taxonomia: Latrocínio -> homicide");
  assert(adapter.mapCrimeToCanonical('Feminicídio') === 'homicide', "19. Taxonomia: Feminicídio -> homicide");
  assert(adapter.mapCrimeToCanonical('Tentativa de Homicídio') === 'bodily_harm', "20. Taxonomia: Tentativa de Homicídio -> bodily_harm");
  assert(adapter.mapCrimeToCanonical('Roubo de Veículo') === 'vehicle_robbery', "21. Taxonomia: Roubo de Veículo -> vehicle_robbery");
  assert(adapter.mapCrimeToCanonical('Furto de Veículo') === 'vehicle_theft', "22. Taxonomia: Furto de Veículo -> vehicle_theft");
  assert(adapter.mapCrimeToCanonical('Roubo de Carga') === 'cargo_theft', "23. Taxonomia: Roubo de Carga -> cargo_theft");
  assert(adapter.mapCrimeToCanonical('Estupro') === 'sexual_crime', "24. Taxonomia: Estupro -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Tráfico de Entorpecentes') === 'drug_related', "25. Taxonomia: Tráfico de Entorpecentes -> drug_related");
  assert(adapter.mapCrimeToCanonical('Rubrica Aleatória') === 'other', "26. Taxonomia: Fallback seguro para other");

  // 6. Normalização Geoespacial de Municípios e Aliases do RS
  const normPoa = GeoNormalizationService.canonicalizeMunicipalityName('POA');
  const normSleopoldo = GeoNormalizationService.canonicalizeMunicipalityName('S. Leopoldo');
  const normLivramento = GeoNormalizationService.canonicalizeMunicipalityName('Santana do Livramento');
  const normSborja = GeoNormalizationService.canonicalizeMunicipalityName('S. Borja');
  assert(normPoa === 'porto alegre', "27. Normalização de alias 'POA' -> 'porto alegre'");
  assert(normSleopoldo === 'sao leopoldo', "28. Normalização de alias 'S. Leopoldo' -> 'sao leopoldo'");
  assert(normLivramento === 'sant ana do livramento', "29. Normalização de toponímia 'Santana do Livramento' -> 'sant ana do livramento'");
  assert(normSborja === 'sao borja', "30. Normalização de alias 'S. Borja' -> 'sao borja'");

  // 7. Teste End-to-End no Pipeline com Fixture Real do RS
  console.log("\n--- TESTE END-TO-END: PIPELINE COMPLETO COM FIXTURE DO RS ---");
  const rsFixturePath = path.resolve('tests/fixtures/ssp-rs/ssp_rs_municipios_wide_real.csv');
  const rsStream = fs.createReadStream(rsFixturePath);

  // Armazenamento RAW Imutável
  const storedRs = await rawStorage.put('ssp-rs', `audit_${Date.now()}`, 'ssp_rs_municipios_wide_real.csv', rsStream);
  assert(fs.existsSync(storedRs.path) && storedRs.metadata.size > 0, "31. Armazenamento RAW da fonte SSP-RS com SHA-256 e bytes calculados");

  // Criação de Job de Ingestão via JobManager
  const jobResult = await JobManager.createJob({
    sourceId: 'SSP-RS',
    datasetId: 'indicadores_municipais_rs',
    rawFilePath: storedRs.path,
    originalFilename: 'ssp_rs_municipios_wide_real.csv',
    checksum: storedRs.metadata.checksum,
    fileSize: storedRs.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "32. Criação e agendamento de Job de Ingestão para SSP-RS");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "33. Job persistido no banco com status QUEUED");

  // Execução pelo IngestionWorker
  const worker = new IngestionWorker('ssp-rs-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "34. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 11, `35. 11 municípios gaúchos processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted >= 80, `36. Indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Verificação de Persistência no Banco de Dados
  const indicatorsInDb = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-RS'));

  assert(indicatorsInDb.length >= 80, `37. Indicadores do Rio Grande do Sul persistidos no banco (${indicatorsInDb.length} registros)`);

  const poaHomicides = indicatorsInDb.find(i => 
    i.municipalityCode === '4314902' && 
    i.category === 'homicide' && 
    i.period === '2024-01'
  );
  assert(poaHomicides?.value === 22, "38. Registro validado com precisão: Porto Alegre Jan/2024 Homicídio Doloso = 22");

  const caxiasThefts = indicatorsInDb.find(i => 
    i.municipalityCode === '4305108' && 
    i.category === 'theft' && 
    i.period === '2024-01'
  );
  assert(caxiasThefts?.value === 480, "39. Registro validado com precisão: Caxias do Sul Jan/2024 Furto = 480");

  // 9. Teste de Idempotência e Reprocessamento
  console.log("\n--- TESTE DE IDEMPOTÊNCIA E REPROCESSAMENTO ---");
  const countBeforeReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-RS'));

  const reprocessJob = await JobManager.reprocessJob(jobResult.jobId);
  assert(reprocessJob.success && !!reprocessJob.jobId, "40. Agendamento de reprocessamento a partir do RAW preservado");

  const [dbReprocessJob] = await db.select().from(dataImports).where(eq(dataImports.id, reprocessJob.jobId));
  const reprocessResult = await worker.processJobDirectly(dbReprocessJob);
  assert(reprocessResult.success, "41. IngestionWorker conclui reprocessamento com sucesso");

  const countAfterReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-RS'));

  assert(
    Number(countBeforeReprocess[0].count) === Number(countAfterReprocess[0].count),
    "42. Idempotência absoluta garantida: contagem de indicadores não duplica nem se altera após reprocessamento"
  );

  // 10. Atualização do Status Operacional da Fonte
  const [updatedSource] = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-rs'`);
  assert(updatedSource?.status === 'OPERATIONAL', "43. Status operacional da fonte SSP-RS configurado para OPERATIONAL");

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`  RESULTADO DA AUDITORIA SSP-RS: ${passed}/${passed + failed} TESTES APROVADOS`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error(`ERRO: ${failed} testes falharam na auditoria do adapter SSP-RS.`);
    process.exit(1);
  } else {
    console.log('TODAS AS ASSERÇÕES DO ADAPTER SSP-RS FORAM VALIDADAS COM 100% DE SUCESSO!');
    process.exit(0);
  }
}

runSspRsAudit().catch(err => {
  console.error("Falha fatal na execução da auditoria SSP-RS:", err);
  process.exit(1);
});
