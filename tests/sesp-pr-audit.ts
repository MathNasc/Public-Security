import { SespPrAdapter } from '../src/ingestion/adapters/sesp-pr/SespPrAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators, geographicMunicipalities } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSespPrAudit() {
  console.log("================================================================================");
  console.log("          AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SESP-PR (PARANÁ)            ");
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

  // 0. Assegurar Fonte SESP-PR e Municípios Principais do PR no Banco de Dados
  const prSource = await db.select().from(dataSources).where(sql`lower(id) = 'sesp-pr'`);
  if (prSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SESP-PR',
      name: 'Secretaria da Segurança Pública do Paraná',
      provider: 'SESP-PR',
      coverage: 'PR',
      state: 'PR',
      sourceType: 'csv',
      url: 'https://www.seguranca.pr.gov.br/Estatisticas',
      officialUrl: 'https://www.seguranca.pr.gov.br/',
      documentationUrl: 'https://www.dados.pr.gov.br/',
      description: 'Estatísticas criminais e relatórios estatísticos consolidados pelo CAPE para os 399 municípios do Paraná.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Assegura municípios principais do PR em geographic_municipalities
  const prMunis = [
    { code: '4106902', stateAcronym: 'PR', stateName: 'Paraná', name: 'Curitiba', normalizedName: 'curitiba', latitude: -25.4284, longitude: -49.2733 },
    { code: '4113700', stateAcronym: 'PR', stateName: 'Paraná', name: 'Londrina', normalizedName: 'londrina', latitude: -23.3045, longitude: -51.1696 },
    { code: '4115200', stateAcronym: 'PR', stateName: 'Paraná', name: 'Maringá', normalizedName: 'maringa', latitude: -23.4205, longitude: -51.9333 },
    { code: '4119905', stateAcronym: 'PR', stateName: 'Paraná', name: 'Ponta Grossa', normalizedName: 'ponta grossa', latitude: -25.0994, longitude: -50.1583 },
    { code: '4104808', stateAcronym: 'PR', stateName: 'Paraná', name: 'Cascavel', normalizedName: 'cascavel', latitude: -24.9578, longitude: -53.4595 },
    { code: '4108304', stateAcronym: 'PR', stateName: 'Paraná', name: 'Foz do Iguaçu', normalizedName: 'foz do iguacu', latitude: -25.5469, longitude: -54.5882 },
    { code: '4125506', stateAcronym: 'PR', stateName: 'Paraná', name: 'São José dos Pinhais', normalizedName: 'sao jose dos pinhais', latitude: -25.5347, longitude: -49.2064 },
    { code: '4105805', stateAcronym: 'PR', stateName: 'Paraná', name: 'Colombo', normalizedName: 'colombo', latitude: -25.2917, longitude: -49.2242 },
    { code: '4109401', stateAcronym: 'PR', stateName: 'Paraná', name: 'Guarapuava', normalizedName: 'guarapuava', latitude: -25.3953, longitude: -51.4581 },
    { code: '4118204', stateAcronym: 'PR', stateName: 'Paraná', name: 'Paranaguá', normalizedName: 'paranagua', latitude: -25.5205, longitude: -48.5095 },
    { code: '4101804', stateAcronym: 'PR', stateName: 'Paraná', name: 'Araucária', normalizedName: 'araucaria', latitude: -25.5928, longitude: -49.3897 }
  ];

  for (const muni of prMunis) {
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

  const adapter = new SespPrAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SESP-PR' && meta.coverage === 'PR' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do estado do Paraná");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SESP-PR' && discovery.url.includes('Estatisticas'), "3. Discovery oficial apontando para repositório da SESP-PR");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo', 'furto', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial (Padrão SESP-PR)");

  const verticalHeaders = ['codigo_ibge', 'municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_PR_A', 'COLUNA_DESCONHECIDA_PR_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '4106902',
    municipio: 'Curitiba',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '18',
    latrocinio: '1',
    feminicidio: '2',
    roubo_veiculo: '95',
    furto_veiculo: '185',
    roubo: '720',
    furto: '1680',
    estupro: '32',
    trafico_drogas: '210',
    apreensao_armas: '68'
  }) as any[];

  assert(Array.isArray(parsedWide) && parsedWide.length >= 8, "7. Desdobramento de colunas largas em múltiplos registros de indicadores");
  const cwbHom = parsedWide.find(r => r.data.category === 'homicide' && r.data.subcategory === 'homicidio_doloso');
  const cwbLat = parsedWide.find(r => r.data.category === 'homicide' && r.data.subcategory === 'latrocinio');
  const cwbVehRob = parsedWide.find(r => r.data.category === 'vehicle_robbery');
  const cwbVehTheft = parsedWide.find(r => r.data.category === 'vehicle_theft');
  const cwbRobbery = parsedWide.find(r => r.data.category === 'robbery');
  const cwbTheft = parsedWide.find(r => r.data.category === 'theft');
  const cwbDrugs = parsedWide.find(r => r.data.category === 'drug_related');
  const cwbArms = parsedWide.find(r => r.data.category === 'other' && r.data.subcategory === 'armas_apreendidas');

  assert(cwbHom?.data.value === 18 && cwbHom?.data.period === '2024-01', "8. Mapeamento Wide: Homicídio Doloso (18 vítimas, 2024-01)");
  assert(cwbLat?.data.value === 1 && cwbLat?.data.category === 'homicide', "9. Mapeamento Canônico de Latrocínio para Homicide");
  assert(cwbVehRob?.data.value === 95 && cwbVehRob?.data.category === 'vehicle_robbery', "10. Mapeamento Canônico de Roubo de Veículo");
  assert(cwbVehTheft?.data.value === 185 && cwbVehTheft?.data.category === 'vehicle_theft', "11. Mapeamento Canônico de Furto de Veículo");
  assert(cwbRobbery?.data.value === 720 && cwbRobbery?.data.category === 'robbery', "12. Mapeamento Canônico de Roubo Geral");
  assert(cwbTheft?.data.value === 1680 && cwbTheft?.data.category === 'theft', "13. Mapeamento Canônico de Furto Geral");
  assert(cwbDrugs?.data.value === 210 && cwbDrugs?.data.category === 'drug_related', "14. Mapeamento Canônico de Tráfico de Drogas");
  assert(cwbArms?.data.value === 68 && cwbArms?.data.unit === 'armas', "15. Mapeamento Canônico de Apreensão de Armas");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    codigo_ibge: '4113700',
    municipio: 'Londrina',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Homicídio Doloso',
    quantidade: '5'
  }) as any[];

  assert(Array.isArray(parsedVertical) && parsedVertical.length === 1, "16. Parsing de registro vertical com conversão de nome do mês");
  assert(parsedVertical[0].data.category === 'homicide' && parsedVertical[0].data.period === '2024-02', "17. Conversão de Fevereiro para período 2024-02");

  // 5. Mapeamento Taxonômico Canônico
  assert(adapter.mapCrimeToCanonical('Homicídio Doloso') === 'homicide', "18. Taxonomia: Homicídio Doloso -> homicide");
  assert(adapter.mapCrimeToCanonical('Latrocínio') === 'homicide', "19. Taxonomia: Latrocínio -> homicide");
  assert(adapter.mapCrimeToCanonical('Feminicídio') === 'homicide', "20. Taxonomia: Feminicídio -> homicide");
  assert(adapter.mapCrimeToCanonical('Tentativa de Homicídio') === 'bodily_harm', "21. Taxonomia: Tentativa de Homicídio -> bodily_harm");
  assert(adapter.mapCrimeToCanonical('Roubo de Veículo') === 'vehicle_robbery', "22. Taxonomia: Roubo de Veículo -> vehicle_robbery");
  assert(adapter.mapCrimeToCanonical('Furto de Veículo') === 'vehicle_theft', "23. Taxonomia: Furto de Veículo -> vehicle_theft");
  assert(adapter.mapCrimeToCanonical('Roubo de Carga') === 'cargo_theft', "24. Taxonomia: Roubo de Carga -> cargo_theft");
  assert(adapter.mapCrimeToCanonical('Estupro') === 'sexual_crime', "25. Taxonomia: Estupro -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Tráfico de Drogas') === 'drug_related', "26. Taxonomia: Tráfico de Drogas -> drug_related");
  assert(adapter.mapCrimeToCanonical('Delito Desconhecido') === 'other', "27. Taxonomia: Fallback seguro para other");

  // 6. Normalização Geoespacial de Municípios e Aliases do PR
  const normCwb = GeoNormalizationService.canonicalizeMunicipalityName('CWB');
  const normSjp = GeoNormalizationService.canonicalizeMunicipalityName('S. José dos Pinhais');
  const normFoz = GeoNormalizationService.canonicalizeMunicipalityName('Foz');
  const normPg = GeoNormalizationService.canonicalizeMunicipalityName('PG');
  assert(normCwb === 'curitiba', "28. Normalização de alias 'CWB' -> 'curitiba'");
  assert(normSjp === 'sao jose dos pinhais', "29. Normalização de alias 'S. José dos Pinhais' -> 'sao jose dos pinhais'");
  assert(normFoz === 'foz do iguacu', "30. Normalização de toponímia 'Foz' -> 'foz do iguacu'");
  assert(normPg === 'ponta grossa', "31. Normalização de alias 'PG' -> 'ponta grossa'");

  // 7. Teste End-to-End no Pipeline com Fixture Real do PR
  console.log("\n--- TESTE END-TO-END: PIPELINE COMPLETO COM FIXTURE DO PR ---");
  const prFixturePath = path.resolve('tests/fixtures/sesp-pr/sesp_pr_municipios_wide_real.csv');
  const prStream = fs.createReadStream(prFixturePath);

  // Armazenamento RAW Imutável
  const storedPr = await rawStorage.put('sesp-pr', `audit_${Date.now()}`, 'sesp_pr_municipios_wide_real.csv', prStream);
  assert(fs.existsSync(storedPr.path) && storedPr.metadata.size > 0, "32. Armazenamento RAW da fonte SESP-PR com SHA-256 e bytes calculados");

  // Criação de Job de Ingestão via JobManager
  const jobResult = await JobManager.createJob({
    sourceId: 'SESP-PR',
    datasetId: 'indicadores_municipais_pr',
    rawFilePath: storedPr.path,
    originalFilename: 'sesp_pr_municipios_wide_real.csv',
    checksum: storedPr.metadata.checksum,
    fileSize: storedPr.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "33. Criação e agendamento de Job de Ingestão para SESP-PR");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "34. Job persistido no banco com status QUEUED");

  // Execução pelo IngestionWorker
  const worker = new IngestionWorker('sesp-pr-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "35. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 11, `36. 11 municípios paranaenses processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted >= 80, `37. Indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Verificação de Persistência no Banco de Dados
  const indicatorsInDb = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SESP-PR'));

  assert(indicatorsInDb.length >= 80, `38. Indicadores do Paraná persistidos no banco (${indicatorsInDb.length} registros)`);

  const curitibaHomicides = indicatorsInDb.find(i => 
    i.municipalityCode === '4106902' && 
    i.category === 'homicide' && 
    i.period === '2024-01'
  );
  assert(curitibaHomicides?.value === 18, "39. Registro validado com precisão: Curitiba Jan/2024 Homicídio Doloso = 18");

  const londrinaThefts = indicatorsInDb.find(i => 
    i.municipalityCode === '4113700' && 
    i.category === 'theft' && 
    i.period === '2024-01'
  );
  assert(londrinaThefts?.value === 510, "40. Registro validado com precisão: Londrina Jan/2024 Furto = 510");

  // 9. Teste de Idempotência e Reprocessamento
  console.log("\n--- TESTE DE IDEMPOTÊNCIA E REPROCESSAMENTO ---");
  const countBeforeReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SESP-PR'));

  const reprocessJob = await JobManager.reprocessJob(jobResult.jobId);
  assert(reprocessJob.success && !!reprocessJob.jobId, "41. Agendamento de reprocessamento a partir do RAW preservado");

  const [dbReprocessJob] = await db.select().from(dataImports).where(eq(dataImports.id, reprocessJob.jobId));
  const reprocessResult = await worker.processJobDirectly(dbReprocessJob);
  assert(reprocessResult.success, "42. IngestionWorker conclui reprocessamento com sucesso");

  const countAfterReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SESP-PR'));

  assert(
    Number(countBeforeReprocess[0].count) === Number(countAfterReprocess[0].count),
    "43. Idempotência absoluta garantida: contagem de indicadores não duplica nem se altera após reprocessamento"
  );

  // 10. Atualização do Status Operacional da Fonte
  const [updatedSource] = await db.select().from(dataSources).where(sql`lower(id) = 'sesp-pr'`);
  assert(updatedSource?.status === 'OPERATIONAL', "44. Status operacional da fonte SESP-PR configurado para OPERATIONAL");

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`  RESULTADO DA AUDITORIA SESP-PR: ${passed}/${passed + failed} TESTES APROVADOS`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error(`ERRO: ${failed} testes falharam na auditoria do adapter SESP-PR.`);
    process.exit(1);
  } else {
    console.log('TODAS AS ASSERÇÕES DO ADAPTER SESP-PR FORAM VALIDADAS COM 100% DE SUCESSO!');
    process.exit(0);
  }
}

runSspRsAudit().catch(err => {
  console.error("Falha fatal na execução da auditoria SESP-PR:", err);
  process.exit(1);
});

async function runSspRsAudit() {
  await runSespPrAudit();
}
