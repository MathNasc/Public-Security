import { SspAmAdapter } from '../src/ingestion/adapters/ssp-am/SspAmAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSspAmAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SSP-AM (AMAZONAS)                 ");
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

  // 0. Assegurar Fonte SSP-AM no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SSP-AM'));

  const amSource = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-am'`);
  if (amSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SSP-AM',
      name: 'Secretaria de Estado de Segurança Pública do Amazonas',
      provider: 'SSP-AM / SIED',
      coverage: 'AM',
      state: 'AM',
      sourceType: 'csv',
      url: 'https://www.seguranca.am.gov.br/estatisticas',
      officialUrl: 'https://www.seguranca.am.gov.br/',
      documentationUrl: 'https://transparencia.am.gov.br/',
      description: 'Estatísticas criminais e dados consolidados pela SSP-AM e Centro Integrado de Estatística.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SspAmAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SSP-AM' && meta.coverage === 'AM' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do Amazonas");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SSP-AM' && discovery.url.includes('seguranca.am.gov.br'), "3. Discovery oficial apontando para repositório do Amazonas");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SSP-AM)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_AM_A', 'COLUNA_DESCONHECIDA_AM_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '1302603',
    municipio: 'Manaus',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '42',
    latrocinio: '4',
    feminicidio: '2',
    lesao_morte: '1',
    roubo_veiculo: '180',
    furto_veiculo: '140',
    roubo_transeunte: '820',
    roubo_comercio: '165',
    roubo_residencia: '58',
    roubo_coletivo: '95',
    pirataria_fluvial: '12',
    furto: '1250',
    estupro: '48',
    trafico_drogas: '280',
    apreensao_armas: '110'
  });

  const wideList = Array.isArray(parsedWide) ? parsedWide : [];
  assert(Array.isArray(parsedWide) && wideList.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = wideList.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 49 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios (CVLI): Soma correta (42 dolosos + 4 latrocínio + 2 feminicídio + 1 lesão morte = 49)");

  const robInd = wideList.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 1150, "9. Indicador de Roubos (CVP): Agregação de Transeunte (820) + Comércio (165) + Residência (58) + Coletivo (95) + Pirataria Fluvial (12) = 1150");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 180, "10. Indicador de Roubo de Veículos normalizado corretamente (180)");

  const vehTheftInd = wideList.find(r => r.data.category === 'vehicle_theft');
  assert(vehTheftInd?.data.value === 140, "11. Indicador de Furto de Veículos normalizado corretamente (140)");

  const theftInd = wideList.find(r => r.data.category === 'theft');
  assert(theftInd?.data.value === 1250, "12. Indicador de Furtos Gerais normalizado corretamente (1250)");

  const drugInd = wideList.find(r => r.data.category === 'drug_related');
  assert(drugInd?.data.value === 280, "13. Indicador de Tráfico de Entorpecentes normalizado corretamente (280)");

  const armsInd = wideList.find(r => r.data.category === 'other');
  assert(armsInd?.data.value === 110 && armsInd?.data.unit === 'armas', "14. Indicador de Apreensão de Armas de Fogo normalizado (110 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    cod_ibge: '1302603',
    municipio: 'Manaus',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Pirataria Fluvial',
    total: '15'
  });
  const vertList = Array.isArray(parsedVertical) ? parsedVertical : [];
  assert(Array.isArray(parsedVertical) && vertList.length === 1, "15. Parsing Vertical: Geração de indicador único");
  assert(vertList[0]?.data.category === 'robbery' && vertList[0]?.data.period === '2024-02', "16. Mapeamento correto de Pirataria Fluvial e mês por extenso");

  // 5. Mapeamento Canônico de Taxonomia Criminal
  assert(adapter.mapCrimeToCanonical('Crimes Violentos Letais Intencionais') === 'homicide', "17. Taxonomia: CVLI -> homicide");
  assert(adapter.mapCrimeToCanonical('Feminicídio') === 'homicide', "18. Taxonomia: Feminicídio -> homicide");
  assert(adapter.mapCrimeToCanonical('Roubo em Transporte Coletivo') === 'robbery', "19. Taxonomia: Roubo em Coletivo -> robbery");
  assert(adapter.mapCrimeToCanonical('Roubo de Embarcação') === 'robbery', "20. Taxonomia: Roubo de Embarcação -> robbery");
  assert(adapter.mapCrimeToCanonical('Tentativa de Homicídio') === 'bodily_harm', "21. Taxonomia: Tentativa de Homicídio -> bodily_harm");
  assert(adapter.mapCrimeToCanonical('Estupro de Vulnerável') === 'sexual_crime', "22. Taxonomia: Estupro de Vulnerável -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Roubo de Carga') === 'cargo_theft', "23. Taxonomia: Roubo de Carga -> cargo_theft");

  // 6. Normalização Geográfica para Municípios Amazonenses
  const manausNorm = GeoNormalizationService.canonicalizeMunicipalityName('Manaus');
  assert(manausNorm === 'manaus', "24. Geo Normalization: Manaus");

  const parintinsNorm = GeoNormalizationService.canonicalizeMunicipalityName('Parintins');
  assert(parintinsNorm === 'parintins', "25. Geo Normalization: Parintins");

  const itacoatiaraNorm = GeoNormalizationService.canonicalizeMunicipalityName('Itacoatiara');
  assert(itacoatiaraNorm === 'itacoatiara', "26. Geo Normalization: Itacoatiara");

  const manacapuruNorm = GeoNormalizationService.canonicalizeMunicipalityName('Manacapuru');
  assert(manacapuruNorm === 'manacapuru', "27. Geo Normalization: Manacapuru");

  const coariNorm = GeoNormalizationService.canonicalizeMunicipalityName('Coari');
  assert(coariNorm === 'coari', "28. Geo Normalization: Coari");

  const maoAlias = GeoNormalizationService.canonicalizeMunicipalityName('MAO');
  assert(maoAlias === 'manaus', "29. Geo Normalization: Alias 'MAO' -> 'manaus'");

  const sGabrielAlias = GeoNormalizationService.canonicalizeMunicipalityName('S. Gabriel da Cachoeira');
  assert(sGabrielAlias === 'sao gabriel da cachoeira', "30. Geo Normalization: Alias 'S. Gabriel da Cachoeira' -> 'sao gabriel da cachoeira'");

  const presFigueiredoAlias = GeoNormalizationService.canonicalizeMunicipalityName('Pres. Figueiredo');
  assert(presFigueiredoAlias === 'presidente figueiredo', "31. Geo Normalization: Alias 'Pres. Figueiredo' -> 'presidente figueiredo'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/ssp-am/ssp_am_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "32. Fixture CSV Wide de municípios amazonenses existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('ssp-am', `audit_${Date.now()}`, 'ssp_am_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "33. Armazenamento RAW da fonte SSP-AM com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SSP-AM',
    datasetId: 'indicadores_municipais_am',
    rawFilePath: storedWide.path,
    originalFilename: 'ssp_am_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true,
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });
  assert(!!jobResult && !!jobResult.jobId, "34. Criação e agendamento de Job de Ingestão para SSP-AM");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "35. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('ssp-am-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "36. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 16, `37. 16 municípios do AM processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 128, `38. 128 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/ssp-am/ssp_am_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('ssp-am', `audit_vert_${Date.now()}`, 'ssp_am_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SSP-AM',
    datasetId: 'indicadores_municipais_am',
    rawFilePath: storedVert.path,
    originalFilename: 'ssp_am_vertical_real.csv',
    checksum: storedVert.metadata.checksum,
    fileSize: storedVert.metadata.size,
    force: true,
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });

  const [dbVertJob] = await db.select().from(dataImports).where(eq(dataImports.id, vertJobResult.jobId));
  const vertRunResult = await worker.processJobDirectly(dbVertJob);
  assert(vertRunResult.success, "39. Processamento do Job SSP-AM (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "40. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/ssp-am/ssp_am_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('ssp-am', `audit_corrupt_${Date.now()}`, 'ssp_am_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SSP-AM',
    datasetId: 'indicadores_municipais_am',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'ssp_am_corrupted_schema.csv',
    checksum: storedCorrupt.metadata.checksum,
    fileSize: storedCorrupt.metadata.size,
    force: true,
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });

  const [dbCorruptJob] = await db.select().from(dataImports).where(eq(dataImports.id, corruptJobResult.jobId));
  const corruptRunResult = await worker.processJobDirectly(dbCorruptJob);
  assert(!corruptRunResult.success, "41. Quality Gate: Rejeição automática de dataset com schema corrompido");
  assert(corruptRunResult.error?.includes('Quality Gate'), "42. Mensagem de erro explícita de violação do Quality Gate");

  // 10. Verificação no Banco de Dados Real
  const dbIndicators = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-AM'));

  assert(dbIndicators.length === 136, `43. Verificação DB: Total de 136 registros consolidados (${dbIndicators.length} encontrados)`);

  const manausHomicide = dbIndicators.find(i => i.municipalityCode === '1302603' && i.category === 'homicide' && i.period === '2024-01');
  assert(manausHomicide?.value === 49, "44. Verificação DB: 49 vítimas de homicídio registradas em Manaus no período 2024-01");

  const manausRobbery = dbIndicators.find(i => i.municipalityCode === '1302603' && i.category === 'robbery' && i.period === '2024-01');
  assert(manausRobbery?.value === 1150, "45. Verificação DB: 1150 roubos em Manaus (820 transeunte + 165 com + 58 res + 95 coletivo + 12 fluvial)");

  const tabatingaDrug = dbIndicators.find(i => i.municipalityCode === '1304062' && i.category === 'drug_related' && i.period === '2024-01');
  assert(tabatingaDrug?.value === 45, "46. Verificação DB: 45 ocorrências de drogas em Tabatinga");

  const itacoatiaraVeh = dbIndicators.find(i => i.municipalityCode === '1301902' && i.category === 'vehicle_robbery' && i.period === '2024-01');
  assert(itacoatiaraVeh?.value === 12, "47. Verificação DB: 12 roubos de veículos em Itacoatiara");

  const manacapuruTheft = dbIndicators.find(i => i.municipalityCode === '1302504' && i.category === 'theft' && i.period === '2024-01');
  assert(manacapuruTheft?.value === 145, "48. Verificação DB: 145 furtos em Manacapuru");

  const coariRobbery = dbIndicators.find(i => i.municipalityCode === '1301209' && i.category === 'robbery' && i.period === '2024-01');
  assert(coariRobbery?.value === 69, "49. Verificação DB: 69 roubos em Coari (38 transeunte + 9 com + 5 res + 1 col + 16 fluvial)");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SSP-AM',
    datasetId: 'indicadores_municipais_am',
    rawFilePath: storedWide.path,
    originalFilename: 'ssp_am_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true,
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });

  const [dbDupJob] = await db.select().from(dataImports).where(eq(dataImports.id, dupJobResult.jobId));
  const dupRunResult = await worker.processJobDirectly(dbDupJob);
  assert(dupRunResult.success, "50. Re-execução do Job com mesmo dataset concluída com sucesso");

  const dbIndicatorsAfterDup = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-AM'));

  assert(dbIndicatorsAfterDup.length === 136, "51. Idempotência: Contagem total inalterada no banco de dados (136 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-am'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "52. Status da fonte SSP-AM atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SSP-AM: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSspAmAudit().catch(err => {
  console.error("Erro fatal na auditoria SSP-AM:", err);
  process.exit(1);
});
