import { SspDfAdapter } from '../src/ingestion/adapters/ssp-df/SspDfAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators, geographicMunicipalities } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSspDfAudit() {
  console.log("================================================================================");
  console.log("       AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SSP-DF (DISTRITO FEDERAL)       ");
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

  // 0. Assegurar Fonte SSP-DF e Brasília no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SSP-DF'));

  const dfSource = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-df'`);
  if (dfSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SSP-DF',
      name: 'Secretaria de Estado de Segurança Pública do Distrito Federal',
      provider: 'SSP-DF',
      coverage: 'DF',
      state: 'DF',
      sourceType: 'csv',
      url: 'https://dados.df.gov.br/',
      officialUrl: 'https://www.ssp.df.gov.br/',
      documentationUrl: 'https://www.ssp.df.gov.br/estatisticas/',
      description: 'Estatísticas criminais consolidadas pela SGI/GEAC para as 35 Regiões Administrativas do Distrito Federal.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Assegura Brasília/DF em geographic_municipalities
  const brasiliaCode = '5300108';
  const existingDf = await db.select().from(geographicMunicipalities).where(eq(geographicMunicipalities.code, brasiliaCode));
  if (existingDf.length === 0) {
    await db.insert(geographicMunicipalities).values({
      code: brasiliaCode,
      stateAcronym: 'DF',
      stateName: 'Distrito Federal',
      name: 'Brasília',
      normalizedName: 'brasilia',
      latitude: -15.7975,
      longitude: -47.8919,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SspDfAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SSP-DF' && meta.coverage === 'DF' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do Distrito Federal");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SSP-DF' && discovery.url.includes('dados.df.gov.br'), "3. Discovery oficial apontando para repositório da SSP-DF");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'regiao_administrativa', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial por RAs (Padrão SSP-DF)");

  const verticalHeaders = ['ra', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical de RAs");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_DF_A', 'COLUNA_DESCONHECIDA_DF_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '5300108',
    regiao_administrativa: 'Ceilândia',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '8',
    latrocinio: '1',
    feminicidio: '0',
    lesao_morte: '0',
    roubo_veiculo: '45',
    furto_veiculo: '36',
    roubo_transeunte: '240',
    roubo_comercio: '28',
    roubo_residencia: '14',
    roubo_coletivo: '18',
    furto: '480',
    estupro: '14',
    trafico_drogas: '75',
    apreensao_armas: '28'
  }) as any[];

  assert(Array.isArray(parsedWide) && parsedWide.length === 8, "7. Desdobramento de colunas largas em 8 registros canônicos por RA");
  const recHomicide = parsedWide.find(r => r.data.category === 'homicide');
  const recVehRob = parsedWide.find(r => r.data.category === 'vehicle_robbery');
  const recVehTheft = parsedWide.find(r => r.data.category === 'vehicle_theft');
  const recRobbery = parsedWide.find(r => r.data.category === 'robbery');
  const recTheft = parsedWide.find(r => r.data.category === 'theft');
  const recSexual = parsedWide.find(r => r.data.category === 'sexual_crime');
  const recDrugs = parsedWide.find(r => r.data.category === 'drug_related');
  const recArms = parsedWide.find(r => r.data.category === 'other');

  assert(recHomicide?.data.value === 9 && recHomicide?.data.period === '2024-01', "8. Mapeamento Wide: Mortes Violentas (9 vítimas = 8 hom + 1 latro)");
  assert(recVehRob?.data.value === 45 && recVehRob?.data.category === 'vehicle_robbery', "9. Mapeamento Canônico de Roubo de Veículo (45 ocorrências)");
  assert(recVehTheft?.data.value === 36 && recVehTheft?.data.category === 'vehicle_theft', "10. Mapeamento Canônico de Furto de Veículo (36 ocorrências)");
  assert(recRobbery?.data.value === 300 && recRobbery?.data.category === 'robbery', "11. Mapeamento Canônico de Roubos Agregados (300 ocorrências = 240 transeunte + 28 comercio + 14 residencia + 18 coletivo)");
  assert(recTheft?.data.value === 480 && recTheft?.data.category === 'theft', "12. Mapeamento Canônico de Furto Geral (480 ocorrências)");
  assert(recSexual?.data.value === 14 && recSexual?.data.category === 'sexual_crime', "13. Mapeamento Canônico de Crimes Sexuais (14 vítimas)");
  assert(recDrugs?.data.value === 75 && recDrugs?.data.category === 'drug_related', "14. Mapeamento Canônico de Tráfico de Drogas (75 ocorrências)");
  assert(recArms?.data.value === 28 && recArms?.data.unit === 'armas', "15. Mapeamento Canônico de Apreensão de Armas (28 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    ra: 'Taguatinga',
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
  assert(adapter.mapCrimeToCanonical('Lesão Corporal Seguida de Morte') === 'homicide', "21. Taxonomia: Lesão Morte -> homicide");
  assert(adapter.mapCrimeToCanonical('CVLI') === 'homicide', "22. Taxonomia: CVLI -> homicide");
  assert(adapter.mapCrimeToCanonical('Tentativa de Homicídio') === 'bodily_harm', "23. Taxonomia: Tentativa de Homicídio -> bodily_harm");
  assert(adapter.mapCrimeToCanonical('Roubo de Veículo') === 'vehicle_robbery', "24. Taxonomia: Roubo de Veículo -> vehicle_robbery");
  assert(adapter.mapCrimeToCanonical('Furto de Veículo') === 'vehicle_theft', "25. Taxonomia: Furto de Veículo -> vehicle_theft");
  assert(adapter.mapCrimeToCanonical('Roubo em Transporte Coletivo') === 'robbery', "26. Taxonomia: Roubo Coletivo -> robbery");
  assert(adapter.mapCrimeToCanonical('Roubo a Transeunte') === 'robbery', "27. Taxonomia: Roubo a Transeunte -> robbery");
  assert(adapter.mapCrimeToCanonical('Roubo em Comércio') === 'robbery', "28. Taxonomia: Roubo Comercial -> robbery");
  assert(adapter.mapCrimeToCanonical('Roubo de Carga') === 'cargo_theft', "29. Taxonomia: Roubo de Carga -> cargo_theft");
  assert(adapter.mapCrimeToCanonical('Estupro') === 'sexual_crime', "30. Taxonomia: Estupro -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Tráfico de Drogas') === 'drug_related', "31. Taxonomia: Tráfico de Drogas -> drug_related");
  assert(adapter.mapCrimeToCanonical('Delito Desconhecido') === 'other', "32. Taxonomia: Fallback seguro para other");

  // 6. Normalização Geoespacial de RAs e Aliases do DF
  const normBsb = GeoNormalizationService.canonicalizeMunicipalityName('BSB');
  const normPlanoPiloto = GeoNormalizationService.canonicalizeMunicipalityName('Plano Piloto');
  const normRaCeilandia = GeoNormalizationService.canonicalizeMunicipalityName('RA IX - Ceilandia');
  const normRaTaguatinga = GeoNormalizationService.canonicalizeMunicipalityName('RA III - Taguatinga');
  const normRaAguasClaras = GeoNormalizationService.canonicalizeMunicipalityName('RA XX - Aguas Claras');
  const normRaFercal = GeoNormalizationService.canonicalizeMunicipalityName('RA XXXI - Fercal');
  assert(normBsb === 'brasilia', "33. Normalização de alias 'BSB' -> 'brasilia'");
  assert(normPlanoPiloto === 'brasilia', "34. Normalização de alias 'Plano Piloto' -> 'brasilia'");
  assert(normRaCeilandia === 'brasilia', "35. Normalização de RA 'RA IX - Ceilandia' -> 'brasilia'");
  assert(normRaTaguatinga === 'brasilia', "36. Normalização de RA 'RA III - Taguatinga' -> 'brasilia'");
  assert(normRaAguasClaras === 'brasilia', "37. Normalização de RA 'RA XX - Aguas Claras' -> 'brasilia'");
  assert(normRaFercal === 'brasilia', "38. Normalização de RA 'RA XXXI - Fercal' -> 'brasilia'");

  // 7. Teste End-to-End no Pipeline com Fixture Real do DF
  console.log("\n--- TESTE END-TO-END: PIPELINE COMPLETO COM FIXTURE DO DISTRITO FEDERAL ---");
  const dfFixturePath = path.resolve('tests/fixtures/ssp-df/ssp_df_ras_wide_real.csv');
  const dfStream = fs.createReadStream(dfFixturePath);

  // Armazenamento RAW Imutável
  const storedDf = await rawStorage.put('ssp-df', `audit_${Date.now()}`, 'ssp_df_ras_wide_real.csv', dfStream);
  assert(fs.existsSync(storedDf.path) && storedDf.metadata.size > 0, "39. Armazenamento RAW da fonte SSP-DF com SHA-256 e bytes calculados");

  // Criação de Job de Ingestão via JobManager
  const jobResult = await JobManager.createJob({
    sourceId: 'SSP-DF',
    datasetId: 'indicadores_criminais_df',
    rawFilePath: storedDf.path,
    originalFilename: 'ssp_df_ras_wide_real.csv',
    checksum: storedDf.metadata.checksum,
    fileSize: storedDf.metadata.size,
    force: true,
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });
  assert(!!jobResult && !!jobResult.jobId, "40. Criação e agendamento de Job de Ingestão para SSP-DF");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "41. Job persistido no banco com status QUEUED");

  // Execução pelo IngestionWorker
  const worker = new IngestionWorker('ssp-df-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "42. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 14, `43. 14 Regiões Administrativas do DF processadas (${runResult.metrics.recordsRead} lidas)`);
  assert(runResult.metrics.recordsInserted === 112, `44. 112 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Verificação de Persistência no Banco de Dados
  const indicatorsInDb = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-DF'));

  assert(indicatorsInDb.length === 112, `45. Exatamente 112 indicadores do Distrito Federal persistidos no banco (${indicatorsInDb.length} registros)`);

  const ceilandiaHomicides = indicatorsInDb.find(i => 
    i.municipalityCode?.includes('ceilandia') && 
    i.category === 'homicide' && 
    i.period === '2024-01'
  );
  assert(ceilandiaHomicides?.value === 9, "46. Registro validado com precisão: Ceilândia Jan/2024 Mortes Violentas = 9");

  const planoPilotoRobbery = indicatorsInDb.find(i => 
    i.municipalityCode?.includes('plano_piloto') && 
    i.category === 'robbery' && 
    i.period === '2024-01'
  );
  assert(planoPilotoRobbery?.value === 218, "47. Registro validado com precisão: Plano Piloto Jan/2024 Roubos Agregados = 218 (180 transeunte + 22 comercio + 6 residencia + 10 coletivo)");

  // 9. Teste de Idempotência e Reprocessamento
  console.log("\n--- TESTE DE IDEMPOTÊNCIA E REPROCESSAMENTO ---");
  const countBeforeReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-DF'));

  const reprocessJob = await JobManager.reprocessJob(jobResult.jobId);
  assert(reprocessJob.success && !!reprocessJob.jobId, "48. Agendamento de reprocessamento a partir do RAW preservado");

  const [dbReprocessJob] = await db.select().from(dataImports).where(eq(dataImports.id, reprocessJob.jobId));
  const reprocessResult = await worker.processJobDirectly(dbReprocessJob);
  assert(reprocessResult.success, "49. IngestionWorker conclui reprocessamento com sucesso");

  const countAfterReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-DF'));

  assert(
    Number(countBeforeReprocess[0].count) === Number(countAfterReprocess[0].count),
    "50. Idempotência absoluta garantida: contagem de indicadores não duplica nem se altera após reprocessamento"
  );

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`  RESULTADO DA AUDITORIA SSP-DF: ${passed}/${passed + failed} TESTES APROVADOS`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error(`ERRO: ${failed} testes falharam na auditoria do adapter SSP-DF.`);
    process.exit(1);
  } else {
    console.log('TODAS AS ASSERÇÕES DO ADAPTER SSP-DF FORAM VALIDADAS COM 100% DE SUCESSO!');
    process.exit(0);
  }
}

runSspDfAudit().catch(err => {
  console.error("Falha fatal na execução da auditoria SSP-DF:", err);
  process.exit(1);
});
