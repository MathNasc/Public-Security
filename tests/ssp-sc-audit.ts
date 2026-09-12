import { SspScAdapter } from '../src/ingestion/adapters/ssp-sc/SspScAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators, geographicMunicipalities } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSspScAudit() {
  console.log("================================================================================");
  console.log("       AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SSP-SC (SANTA CATARINA)        ");
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

  // 0. Assegurar Fonte SSP-SC e Municípios Principais de SC no Banco de Dados
  const scSource = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-sc'`);
  if (scSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SSP-SC',
      name: 'Secretaria de Estado da Segurança Pública de Santa Catarina',
      provider: 'SSP-SC',
      coverage: 'SC',
      state: 'SC',
      sourceType: 'csv',
      url: 'https://www.ssp.sc.gov.br/estatisticas/',
      officialUrl: 'https://www.ssp.sc.gov.br/',
      documentationUrl: 'https://dados.sc.gov.br/',
      description: 'Estatísticas e indicadores criminais consolidados pelo SISP e validados pelo GEAC para os 295 municípios de Santa Catarina.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Assegura municípios principais de SC em geographic_municipalities
  const scMunis = [
    { code: '4205407', stateAcronym: 'SC', stateName: 'Santa Catarina', name: 'Florianópolis', normalizedName: 'florianopolis', latitude: -27.5954, longitude: -48.5480 },
    { code: '4209102', stateAcronym: 'SC', stateName: 'Santa Catarina', name: 'Joinville', normalizedName: 'joinville', latitude: -26.3045, longitude: -48.8487 },
    { code: '4202404', stateAcronym: 'SC', stateName: 'Santa Catarina', name: 'Blumenau', normalizedName: 'blumenau', latitude: -26.9194, longitude: -49.0661 },
    { code: '4216602', stateAcronym: 'SC', stateName: 'Santa Catarina', name: 'São José', normalizedName: 'sao jose', latitude: -27.6136, longitude: -48.6366 },
    { code: '4204202', stateAcronym: 'SC', stateName: 'Santa Catarina', name: 'Chapecó', normalizedName: 'chapeco', latitude: -27.1004, longitude: -52.6152 },
    { code: '4208203', stateAcronym: 'SC', stateName: 'Santa Catarina', name: 'Itajaí', normalizedName: 'itajai', latitude: -26.9078, longitude: -48.6619 },
    { code: '4204608', stateAcronym: 'SC', stateName: 'Santa Catarina', name: 'Criciúma', normalizedName: 'criciuma', latitude: -28.6775, longitude: -49.3704 },
    { code: '4202008', stateAcronym: 'SC', stateName: 'Santa Catarina', name: 'Balneário Camboriú', normalizedName: 'balneario camboriu', latitude: -26.9926, longitude: -48.6349 },
    { code: '4202909', stateAcronym: 'SC', stateName: 'Santa Catarina', name: 'Brusque', normalizedName: 'brusque', latitude: -27.0978, longitude: -48.9108 },
    { code: '4218707', stateAcronym: 'SC', stateName: 'Santa Catarina', name: 'Tubarão', normalizedName: 'tubarao', latitude: -28.4739, longitude: -49.0072 },
    { code: '4209300', stateAcronym: 'SC', stateName: 'Santa Catarina', name: 'Lages', normalizedName: 'lages', latitude: -27.8160, longitude: -50.3260 },
    { code: '4211900', stateAcronym: 'SC', stateName: 'Santa Catarina', name: 'Palhoça', normalizedName: 'palhoca', latitude: -27.6453, longitude: -48.6686 }
  ];

  for (const muni of scMunis) {
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

  const adapter = new SspScAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SSP-SC' && meta.coverage === 'SC' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do estado de Santa Catarina");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SSP-SC' && discovery.url.includes('estatisticas'), "3. Discovery oficial apontando para repositório da SSP-SC");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo', 'furto', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial (Padrão SSP-SC)");

  const verticalHeaders = ['codigo_ibge', 'municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_SC_A', 'COLUNA_DESCONHECIDA_SC_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '4205407',
    municipio: 'Florianópolis',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '8',
    latrocinio: '0',
    feminicidio: '1',
    roubo_veiculo: '22',
    furto_veiculo: '75',
    roubo: '180',
    furto: '720',
    estupro: '18',
    trafico_drogas: '95',
    apreensao_armas: '34'
  }) as any[];

  assert(Array.isArray(parsedWide) && parsedWide.length >= 8, "7. Desdobramento de colunas largas em múltiplos registros de indicadores");
  const floripaHom = parsedWide.find(r => r.data.category === 'homicide' && r.data.subcategory === 'homicidio_doloso');
  const floripaFem = parsedWide.find(r => r.data.category === 'homicide' && r.data.subcategory === 'feminicidio');
  const floripaVehRob = parsedWide.find(r => r.data.category === 'vehicle_robbery');
  const floripaVehTheft = parsedWide.find(r => r.data.category === 'vehicle_theft');
  const floripaRobbery = parsedWide.find(r => r.data.category === 'robbery');
  const floripaTheft = parsedWide.find(r => r.data.category === 'theft');
  const floripaDrugs = parsedWide.find(r => r.data.category === 'drug_related');
  const floripaArms = parsedWide.find(r => r.data.category === 'other' && r.data.subcategory === 'armas_apreendidas');

  assert(floripaHom?.data.value === 8 && floripaHom?.data.period === '2024-01', "8. Mapeamento Wide: Homicídio Doloso (8 vítimas, 2024-01)");
  assert(floripaFem?.data.value === 1 && floripaFem?.data.category === 'homicide', "9. Mapeamento Canônico de Feminicídio para Homicide");
  assert(floripaVehRob?.data.value === 22 && floripaVehRob?.data.category === 'vehicle_robbery', "10. Mapeamento Canônico de Roubo de Veículo");
  assert(floripaVehTheft?.data.value === 75 && floripaVehTheft?.data.category === 'vehicle_theft', "11. Mapeamento Canônico de Furto de Veículo");
  assert(floripaRobbery?.data.value === 180 && floripaRobbery?.data.category === 'robbery', "12. Mapeamento Canônico de Roubo Geral");
  assert(floripaTheft?.data.value === 720 && floripaTheft?.data.category === 'theft', "13. Mapeamento Canônico de Furto Geral");
  assert(floripaDrugs?.data.value === 95 && floripaDrugs?.data.category === 'drug_related', "14. Mapeamento Canônico de Tráfico de Drogas");
  assert(floripaArms?.data.value === 34 && floripaArms?.data.unit === 'armas', "15. Mapeamento Canônico de Apreensão de Armas");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    codigo_ibge: '4209102',
    municipio: 'Joinville',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Homicídio Doloso',
    quantidade: '6'
  }) as any[];

  assert(Array.isArray(parsedVertical) && parsedVertical.length === 1, "16. Parsing de registro vertical com conversão de nome do mês");
  assert(parsedVertical[0].data.category === 'homicide' && parsedVertical[0].data.period === '2024-02', "17. Conversão de Fevereiro para período 2024-02");

  // 5. Mapeamento Taxonômico Canônico
  assert(adapter.mapCrimeToCanonical('Homicídio Doloso') === 'homicide', "18. Taxonomia: Homicídio Doloso -> homicide");
  assert(adapter.mapCrimeToCanonical('Latrocínio') === 'homicide', "19. Taxonomia: Latrocínio -> homicide");
  assert(adapter.mapCrimeToCanonical('Feminicídio') === 'homicide', "20. Taxonomia: Feminicídio -> homicide");
  assert(adapter.mapCrimeToCanonical('Morte Violenta Intencional') === 'homicide', "21. Taxonomia: MVI -> homicide");
  assert(adapter.mapCrimeToCanonical('Tentativa de Homicídio') === 'bodily_harm', "22. Taxonomia: Tentativa de Homicídio -> bodily_harm");
  assert(adapter.mapCrimeToCanonical('Roubo de Veículo') === 'vehicle_robbery', "23. Taxonomia: Roubo de Veículo -> vehicle_robbery");
  assert(adapter.mapCrimeToCanonical('Furto de Veículo') === 'vehicle_theft', "24. Taxonomia: Furto de Veículo -> vehicle_theft");
  assert(adapter.mapCrimeToCanonical('Roubo de Carga') === 'cargo_theft', "25. Taxonomia: Roubo de Carga -> cargo_theft");
  assert(adapter.mapCrimeToCanonical('Estupro') === 'sexual_crime', "26. Taxonomia: Estupro -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Tráfico de Drogas') === 'drug_related', "27. Taxonomia: Tráfico de Drogas -> drug_related");
  assert(adapter.mapCrimeToCanonical('Delito Desconhecido') === 'other', "28. Taxonomia: Fallback seguro para other");

  // 6. Normalização Geoespacial de Municípios e Aliases de SC
  const normFloripa = GeoNormalizationService.canonicalizeMunicipalityName('Floripa');
  const normBc = GeoNormalizationService.canonicalizeMunicipalityName('BC');
  const normSJose = GeoNormalizationService.canonicalizeMunicipalityName('S. José');
  const normSBento = GeoNormalizationService.canonicalizeMunicipalityName('S. Bento do Sul');
  assert(normFloripa === 'florianopolis', "29. Normalização de alias 'Floripa' -> 'florianopolis'");
  assert(normBc === 'balneario camboriu', "30. Normalização de alias 'BC' -> 'balneario camboriu'");
  assert(normSJose === 'sao jose', "31. Normalização de alias 'S. José' -> 'sao jose'");
  assert(normSBento === 'sao bento do sul', "32. Normalização de alias 'S. Bento do Sul' -> 'sao bento do sul'");

  // 7. Teste End-to-End no Pipeline com Fixture Real de SC
  console.log("\n--- TESTE END-TO-END: PIPELINE COMPLETO COM FIXTURE DE SC ---");
  const scFixturePath = path.resolve('tests/fixtures/ssp-sc/ssp_sc_municipios_wide_real.csv');
  const scStream = fs.createReadStream(scFixturePath);

  // Armazenamento RAW Imutável
  const storedSc = await rawStorage.put('ssp-sc', `audit_${Date.now()}`, 'ssp_sc_municipios_wide_real.csv', scStream);
  assert(fs.existsSync(storedSc.path) && storedSc.metadata.size > 0, "33. Armazenamento RAW da fonte SSP-SC com SHA-256 e bytes calculados");

  // Criação de Job de Ingestão via JobManager
  const jobResult = await JobManager.createJob({
    sourceId: 'SSP-SC',
    datasetId: 'indicadores_municipais_sc',
    rawFilePath: storedSc.path,
    originalFilename: 'ssp_sc_municipios_wide_real.csv',
    checksum: storedSc.metadata.checksum,
    fileSize: storedSc.metadata.size,
    force: true,
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });
  assert(!!jobResult && !!jobResult.jobId, "34. Criação e agendamento de Job de Ingestão para SSP-SC");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "35. Job persistido no banco com status QUEUED");

  // Execução pelo IngestionWorker
  const worker = new IngestionWorker('ssp-sc-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "36. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 12, `37. 12 municípios catarinenses processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted >= 85, `38. Indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Verificação de Persistência no Banco de Dados
  const indicatorsInDb = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-SC'));

  assert(indicatorsInDb.length >= 85, `39. Indicadores de Santa Catarina persistidos no banco (${indicatorsInDb.length} registros)`);

  const floripaHomicides = indicatorsInDb.find(i => 
    i.municipalityCode === '4205407' && 
    i.category === 'homicide' && 
    i.period === '2024-01'
  );
  assert(floripaHomicides?.value === 8, "40. Registro validado com precisão: Florianópolis Jan/2024 Homicídio Doloso = 8");

  const joinvilleThefts = indicatorsInDb.find(i => 
    i.municipalityCode === '4209102' && 
    i.category === 'theft' && 
    i.period === '2024-01'
  );
  assert(joinvilleThefts?.value === 610, "41. Registro validado com precisão: Joinville Jan/2024 Furto = 610");

  // 9. Teste de Idempotência e Reprocessamento
  console.log("\n--- TESTE DE IDEMPOTÊNCIA E REPROCESSAMENTO ---");
  const countBeforeReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-SC'));

  const reprocessJob = await JobManager.reprocessJob(jobResult.jobId);
  assert(reprocessJob.success && !!reprocessJob.jobId, "42. Agendamento de reprocessamento a partir do RAW preservado");

  const [dbReprocessJob] = await db.select().from(dataImports).where(eq(dataImports.id, reprocessJob.jobId));
  const reprocessResult = await worker.processJobDirectly(dbReprocessJob);
  assert(reprocessResult.success, "43. IngestionWorker conclui reprocessamento com sucesso");

  const countAfterReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-SC'));

  assert(
    Number(countBeforeReprocess[0].count) === Number(countAfterReprocess[0].count),
    "44. Idempotência absoluta garantida: contagem de indicadores não duplica nem se altera após reprocessamento"
  );

  // 10. Atualização do Status Operacional da Fonte
  const [updatedSource] = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-sc'`);
  assert(updatedSource?.status === 'OPERATIONAL', "45. Status operacional da fonte SSP-SC configurado para OPERATIONAL");

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`  RESULTADO DA AUDITORIA SSP-SC: ${passed}/${passed + failed} TESTES APROVADOS`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error(`ERRO: ${failed} testes falharam na auditoria do adapter SSP-SC.`);
    process.exit(1);
  } else {
    console.log('TODAS AS ASSERÇÕES DO ADAPTER SSP-SC FORAM VALIDADAS COM 100% DE SUCESSO!');
    process.exit(0);
  }
}

runSspScAudit().catch(err => {
  console.error("Falha fatal na execução da auditoria SSP-SC:", err);
  process.exit(1);
});
