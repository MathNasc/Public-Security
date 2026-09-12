import { SspMgAdapter } from '../src/ingestion/adapters/ssp-mg/SspMgAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators, geographicMunicipalities } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSspMgAudit() {
  console.log("================================================================================");
  console.log("         AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SEJUSP-MG (MINAS GERAIS)     ");
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

  // 0. Assegurar Fonte SSP-MG e Municípios Principais de MG no Banco de Dados
  const mgSource = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-mg'`);
  if (mgSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SSP-MG',
      name: 'Secretaria de Estado de Justiça e Segurança Pública de Minas Gerais',
      provider: 'SEJUSP-MG',
      coverage: 'MG',
      state: 'MG',
      sourceType: 'csv',
      url: 'http://dados.mg.gov.br/dataset/estatisticas-seguranca-publica-municipios',
      officialUrl: 'https://www.seguranca.mg.gov.br/',
      documentationUrl: 'http://dados.mg.gov.br/',
      description: 'Estatísticas oficiais de segurança pública e crimes consolidados para os 853 municípios de Minas Gerais.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Assegura municípios principais de MG em geographic_municipalities
  const mgMunis = [
    { code: '3106200', stateAcronym: 'MG', stateName: 'Minas Gerais', name: 'Belo Horizonte', normalizedName: 'belo horizonte', latitude: -19.9167, longitude: -43.9345 },
    { code: '3170206', stateAcronym: 'MG', stateName: 'Minas Gerais', name: 'Uberlândia', normalizedName: 'uberlandia', latitude: -18.9186, longitude: -48.2772 },
    { code: '3136702', stateAcronym: 'MG', stateName: 'Minas Gerais', name: 'Juiz de Fora', normalizedName: 'juiz de fora', latitude: -21.7642, longitude: -43.3496 },
    { code: '3118601', stateAcronym: 'MG', stateName: 'Minas Gerais', name: 'Contagem', normalizedName: 'contagem', latitude: -19.9386, longitude: -44.0536 },
    { code: '3106705', stateAcronym: 'MG', stateName: 'Minas Gerais', name: 'Betim', normalizedName: 'betim', latitude: -19.9678, longitude: -44.1979 },
    { code: '3143302', stateAcronym: 'MG', stateName: 'Minas Gerais', name: 'Montes Claros', normalizedName: 'montes claros', latitude: -16.7282, longitude: -43.8616 },
    { code: '3127701', stateAcronym: 'MG', stateName: 'Minas Gerais', name: 'Governador Valadares', normalizedName: 'governador valadares', latitude: -18.8511, longitude: -41.9494 },
    { code: '3170107', stateAcronym: 'MG', stateName: 'Minas Gerais', name: 'Uberaba', normalizedName: 'uberaba', latitude: -19.7483, longitude: -47.9319 },
    { code: '3131307', stateAcronym: 'MG', stateName: 'Minas Gerais', name: 'Ipatinga', normalizedName: 'ipatinga', latitude: -19.4683, longitude: -42.5364 }
  ];

  for (const muni of mgMunis) {
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

  const adapter = new SspMgAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SEJUSP-MG' && meta.coverage === 'MG' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do estado de Minas Gerais");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SSP-MG' && discovery.url.includes('estatisticas-seguranca-publica-municipios'), "3. Discovery oficial apontando para o catálogo de dados abertos de MG");

  // 2. Schema Validation (Quality Gate)
  const verticalHeaders = ['codigo_ibge', 'municipio', 'ano', 'mes', 'natureza', 'registros', 'vitimas'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Vertical (Padrão Dados Abertos MG)");

  const wideHeaders = ['codigo_ibge', 'municipio', 'ano', 'mes', 'homicidio_consumado', 'roubo_consumado', 'furto_consumado', 'roubo_veiculo'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Horizontal (Matricial por Município)");

  const badHeaders = ['CAMPO_DESCONHECIDO_1', 'CAMPO_DESCONHECIDO_2'];
  const badSchema = adapter.validateSchema(badHeaders);
  assert(!badSchema.valid && (badSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    codigo_ibge: '3106200',
    municipio: 'Belo Horizonte',
    ano: '2024',
    mes: 'Janeiro',
    natureza: 'Homicídio Consumado',
    registros: '28',
    vitimas: '30'
  }) as any[];

  assert(Array.isArray(parsedVertical) && parsedVertical.length === 1, "7. Parsing de registro vertical individual");
  const homRec = parsedVertical[0];
  assert(homRec.data.category === 'homicide' && homRec.data.value === 28 && homRec.data.period === '2024-01', "8. Mapeamento de Homicídio Consumado (28 registros, período 2024-01)");
  assert(homRec.data.municipalityCode === '3106200' && homRec.data.stateCode === 'MG', "9. Código IBGE e UF preservados com fidelidade");

  // 4. Parsing Unitário: Formato Horizontal (Wide)
  const parsedWide = adapter.parseRow({
    codigo_ibge: '3170206',
    municipio: 'Uberlândia',
    ano: '2024',
    mes: '2',
    homicidio_consumado: '5',
    roubo_consumado: '165',
    roubo_veiculo: '40',
    furto_veiculo: '68',
    roubo_carga: '4',
    trafico_de_drogas: '85',
    armas_apreendidas: '35'
  }) as any[];

  assert(Array.isArray(parsedWide) && parsedWide.length >= 6, "10. Desdobramento de colunas largas em múltiplos indicadores");
  const uberRobbery = parsedWide.find(r => r.data.category === 'robbery');
  const uberVehRob = parsedWide.find(r => r.data.category === 'vehicle_robbery');
  const uberVehTheft = parsedWide.find(r => r.data.category === 'vehicle_theft');
  const uberCargo = parsedWide.find(r => r.data.category === 'cargo_theft');
  const uberDrugs = parsedWide.find(r => r.data.category === 'drug_related');

  assert(uberRobbery?.data.value === 165 && uberRobbery?.data.period === '2024-02', "11. Mapeamento Wide: Roubo Consumado (165 registros, 2024-02)");
  assert(uberVehRob?.data.value === 40 && uberVehRob?.data.category === 'vehicle_robbery', "12. Mapeamento Wide: Roubo de Veículo");
  assert(uberVehTheft?.data.value === 68 && uberVehTheft?.data.category === 'vehicle_theft', "13. Mapeamento Wide: Furto de Veículo");
  assert(uberCargo?.data.value === 4 && uberCargo?.data.category === 'cargo_theft', "14. Mapeamento Wide: Roubo de Carga");
  assert(uberDrugs?.data.value === 85 && uberDrugs?.data.category === 'drug_related', "15. Mapeamento Wide: Tráfico de Drogas");

  // 5. Mapeamento Taxonômico Canônico
  assert(adapter.mapCrimeToCanonical('Homicídio Consumado') === 'homicide', "16. Taxonomia: Homicídio Consumado -> homicide");
  assert(adapter.mapCrimeToCanonical('Latrocínio') === 'homicide', "17. Taxonomia: Latrocínio -> homicide");
  assert(adapter.mapCrimeToCanonical('Homicídio Tentado') === 'bodily_harm', "18. Taxonomia: Homicídio Tentado -> bodily_harm");
  assert(adapter.mapCrimeToCanonical('Estupro Consumado') === 'sexual_crime', "19. Taxonomia: Estupro Consumado -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Roubo de Veículo') === 'vehicle_robbery', "20. Taxonomia: Roubo de Veículo -> vehicle_robbery");
  assert(adapter.mapCrimeToCanonical('Furto de Veículo') === 'vehicle_theft', "21. Taxonomia: Furto de Veículo -> vehicle_theft");
  assert(adapter.mapCrimeToCanonical('Roubo de Carga') === 'cargo_theft', "22. Taxonomia: Roubo de Carga -> cargo_theft");
  assert(adapter.mapCrimeToCanonical('Tráfico de Drogas') === 'drug_related', "23. Taxonomia: Tráfico de Drogas -> drug_related");
  assert(adapter.mapCrimeToCanonical('Rubrica Desconhecida') === 'other', "24. Taxonomia: Rubrica Desconhecida -> other");

  // 6. Normalização Geoespacial de Municípios e Aliases de MG
  const normBh = GeoNormalizationService.canonicalizeMunicipalityName('BH');
  const normSjoao = GeoNormalizationService.canonicalizeMunicipalityName('S. João del Rei');
  const normSlourenco = GeoNormalizationService.canonicalizeMunicipalityName('S. Lourenço');
  const normBrazopolis = GeoNormalizationService.canonicalizeMunicipalityName('Brazópolis');
  assert(normBh === 'belo horizonte', "25. Normalização de alias 'BH' -> 'belo horizonte'");
  assert(normSjoao === 'sao joao del rei', "26. Normalização de alias 'S. João del Rei' -> 'sao joao del rei'");
  assert(normSlourenco === 'sao lourenco', "27. Normalização de alias 'S. Lourenço' -> 'sao lourenco'");
  assert(normBrazopolis === 'brasopolis', "28. Normalização de grafia 'Brazópolis' -> 'brasopolis'");

  // 7. Teste de Execução End-to-End no Pipeline com Fixture Real Vertical de MG
  console.log("\n--- TESTE END-TO-END: PIPELINE COMPLETO COM FIXTURE VERTICAL DE MG ---");
  const mgFixturePath = path.resolve('tests/fixtures/ssp-mg/ssp_mg_municipios_vertical_real.csv');
  const mgStream = fs.createReadStream(mgFixturePath);

  // Armazenamento RAW Imutável
  const storedMg = await rawStorage.put('ssp-mg', `audit_${Date.now()}`, 'ssp_mg_municipios_vertical_real.csv', mgStream);
  assert(fs.existsSync(storedMg.path) && storedMg.metadata.size > 0, "29. Armazenamento RAW da fonte SEJUSP-MG com SHA-256 e bytes calculados");

  // Criação de Job de Ingestão via JobManager
  const jobResult = await JobManager.createJob({
    sourceId: 'SSP-MG',
    datasetId: 'indicadores_municipais_mg',
    rawFilePath: storedMg.path,
    originalFilename: 'ssp_mg_municipios_vertical_real.csv',
    checksum: storedMg.metadata.checksum,
    fileSize: storedMg.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "30. Criação e agendamento de Job de Ingestão para SEJUSP-MG");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "31. Job persistido no banco com status QUEUED");

  // Execução pelo IngestionWorker
  const worker = new IngestionWorker('ssp-mg-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "32. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 31, `33. 31 linhas verticais lidas com sucesso (${runResult.metrics.recordsRead} lidas)`);
  assert(runResult.metrics.recordsInserted >= 30, `34. Registros inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Verificação de Persistência no Banco de Dados
  const indicatorsInDb = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-MG'));

  assert(indicatorsInDb.length >= 30, `35. Indicadores de Minas Gerais persistidos no banco (${indicatorsInDb.length} registros)`);

  const bhHomicides = indicatorsInDb.find(i => 
    i.municipalityCode === '3106200' && 
    i.category === 'homicide' && 
    i.sourceCategory === 'Homicídio Consumado' && 
    i.period === '2024-01'
  );
  assert(bhHomicides?.value === 28, "36. Registro validado: Belo Horizonte Jan/2024 Homicídio Consumado = 28");

  const contagemRobberies = indicatorsInDb.find(i => 
    i.municipalityCode === '3118601' && 
    i.category === 'robbery' && 
    i.period === '2024-01'
  );
  assert(contagemRobberies?.value === 310, "37. Registro validado: Contagem Jan/2024 Roubo Consumado = 310");

  // 9. Teste de Idempotência e Reprocessamento
  console.log("\n--- TESTE DE IDEMPOTÊNCIA E REPROCESSAMENTO ---");
  const countBeforeReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-MG'));

  const reprocessJob = await JobManager.reprocessJob(jobResult.jobId);
  assert(reprocessJob.success && !!reprocessJob.jobId, "38. Agendamento de reprocessamento a partir do RAW preservado");

  const [dbReprocessJob] = await db.select().from(dataImports).where(eq(dataImports.id, reprocessJob.jobId));
  const reprocessResult = await worker.processJobDirectly(dbReprocessJob);
  assert(reprocessResult.success, "39. IngestionWorker conclui reprocessamento com sucesso");

  const countAfterReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-MG'));

  assert(
    Number(countBeforeReprocess[0].count) === Number(countAfterReprocess[0].count),
    "40. Idempotência garantida: contagem de indicadores permanece exatamente idêntica após reprocessamento"
  );

  // 10. Atualização do Status Operacional da Fonte
  const [updatedSource] = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-mg'`);
  assert(updatedSource?.status === 'OPERATIONAL', "41. Status operacional da fonte SEJUSP-MG configurado para OPERATIONAL");

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`  RESULTADO DA AUDITORIA SEJUSP-MG: ${passed}/${passed + failed} TESTES APROVADOS`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error(`ERRO: ${failed} testes falharam na auditoria do adapter SEJUSP-MG.`);
    process.exit(1);
  } else {
    console.log('TODAS AS ASSERÇÕES DO ADAPTER SEJUSP-MG FORAM VALIDADAS COM 100% DE SUCESSO!');
    process.exit(0);
  }
}

runSspMgAudit().catch(err => {
  console.error("Falha fatal na execução da auditoria SEJUSP-MG:", err);
  process.exit(1);
});
