import { SegupPaAdapter } from '../src/ingestion/adapters/segup-pa/SegupPaAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSegupPaAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SEGUP-PA (PARÁ)                   ");
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

  // 0. Assegurar Fonte SEGUP-PA no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SEGUP-PA'));

  const paSource = await db.select().from(dataSources).where(sql`lower(id) = 'segup-pa'`);
  if (paSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SEGUP-PA',
      name: 'Secretaria de Estado de Segurança Pública e Defesa Social do Pará',
      provider: 'SEGUP-PA',
      coverage: 'PA',
      state: 'PA',
      sourceType: 'csv',
      url: 'https://www.segup.pa.gov.br/estatisticas',
      officialUrl: 'https://www.segup.pa.gov.br/',
      documentationUrl: 'https://transparencia.pa.gov.br/',
      description: 'Estatísticas criminais e dados consolidados pela Diretoria de Estatística e Análise Criminal (DEAC/SIEDS).',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SegupPaAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SEGUP-PA' && meta.coverage === 'PA' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do Pará");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SEGUP-PA' && discovery.url.includes('segup.pa.gov.br'), "3. Discovery oficial apontando para repositório do Pará");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SEGUP-PA)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_PA_A', 'COLUNA_DESCONHECIDA_PA_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '1501402',
    municipio: 'Belém',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '18',
    latrocinio: '2',
    feminicidio: '1',
    lesao_morte: '0',
    roubo_veiculo: '85',
    furto_veiculo: '62',
    roubo_transeunte: '450',
    roubo_comercio: '88',
    roubo_residencia: '32',
    roubo_coletivo: '45',
    pirataria_fluvial: '6',
    furto: '680',
    estupro: '24',
    trafico_drogas: '142',
    apreensao_armas: '55'
  });

  const wideList = Array.isArray(parsedWide) ? parsedWide : [];
  assert(Array.isArray(parsedWide) && wideList.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = wideList.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 21 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios (CVLI): Soma correta (18 dolosos + 2 latrocínio + 1 feminicídio = 21)");

  const robInd = wideList.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 621, "9. Indicador de Roubos (CVP): Agregação de Transeunte (450) + Comércio (88) + Residência (32) + Coletivo (45) + Pirataria Fluvial (6) = 621");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 85, "10. Indicador de Roubo de Veículos normalizado corretamente (85)");

  const vehTheftInd = wideList.find(r => r.data.category === 'vehicle_theft');
  assert(vehTheftInd?.data.value === 62, "11. Indicador de Furto de Veículos normalizado corretamente (62)");

  const theftInd = wideList.find(r => r.data.category === 'theft');
  assert(theftInd?.data.value === 680, "12. Indicador de Furtos Gerais normalizado corretamente (680)");

  const drugInd = wideList.find(r => r.data.category === 'drug_related');
  assert(drugInd?.data.value === 142, "13. Indicador de Tráfico de Entorpecentes normalizado corretamente (142)");

  const armsInd = wideList.find(r => r.data.category === 'other');
  assert(armsInd?.data.value === 55 && armsInd?.data.unit === 'armas', "14. Indicador de Apreensão de Armas de Fogo normalizado (55 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    cod_ibge: '1501402',
    municipio: 'Belém',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Pirataria Fluvial',
    total: '8'
  });
  const vertList = Array.isArray(parsedVertical) ? parsedVertical : [];
  assert(Array.isArray(parsedVertical) && vertList.length === 1, "15. Parsing Vertical: Geração de indicador único");
  assert(vertList[0]?.data.category === 'robbery' && vertList[0]?.data.period === '2024-02', "16. Mapeamento correto de Pirataria Fluvial e mês por extenso");

  // 5. Mapeamento Canônico de Taxonomia Criminal
  assert(adapter.mapCrimeToCanonical('Crimes Violentos Letais Intencionais') === 'homicide', "17. Taxonomia: CVLI -> homicide");
  assert(adapter.mapCrimeToCanonical('Feminicídio') === 'homicide', "18. Taxonomia: Feminicídio -> homicide");
  assert(adapter.mapCrimeToCanonical('Roubo em Transporte Coletivo') === 'robbery', "19. Taxonomia: Roubo em Coletivo -> robbery");
  assert(adapter.mapCrimeToCanonical('Roubo em Embarcações') === 'robbery', "20. Taxonomia: Roubo em Embarcações -> robbery");
  assert(adapter.mapCrimeToCanonical('Tentativa de Homicídio') === 'bodily_harm', "21. Taxonomia: Tentativa de Homicídio -> bodily_harm");
  assert(adapter.mapCrimeToCanonical('Estupro de Vulnerável') === 'sexual_crime', "22. Taxonomia: Estupro de Vulnerável -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Roubo de Carga') === 'cargo_theft', "23. Taxonomia: Roubo de Carga -> cargo_theft");

  // 6. Normalização Geográfica para Municípios Paraenses
  const belemNorm = GeoNormalizationService.canonicalizeMunicipalityName('Belém');
  assert(belemNorm === 'belem', "24. Geo Normalization: Belém");

  const ananindeuaNorm = GeoNormalizationService.canonicalizeMunicipalityName('Ananindeua');
  assert(ananindeuaNorm === 'ananindeua', "25. Geo Normalization: Ananindeua");

  const santaremNorm = GeoNormalizationService.canonicalizeMunicipalityName('Santarém');
  assert(santaremNorm === 'santarem', "26. Geo Normalization: Santarém");

  const marabaNorm = GeoNormalizationService.canonicalizeMunicipalityName('Marabá');
  assert(marabaNorm === 'maraba', "27. Geo Normalization: Marabá");

  const belemAlias = GeoNormalizationService.canonicalizeMunicipalityName('Belém do Pará');
  assert(belemAlias === 'belem', "28. Geo Normalization: Alias 'Belém do Pará' -> 'belem'");

  const staIzabelAlias = GeoNormalizationService.canonicalizeMunicipalityName('Sta Izabel do Pará');
  assert(staIzabelAlias === 'santa izabel do para', "29. Geo Normalization: Alias 'Sta Izabel do Pará' -> 'santa izabel do para'");

  const sFelixAlias = GeoNormalizationService.canonicalizeMunicipalityName('S. Félix do Xingu');
  assert(sFelixAlias === 'sao felix do xingu', "30. Geo Normalization: Alias 'S. Félix do Xingu' -> 'sao felix do xingu'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/segup-pa/segup_pa_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "31. Fixture CSV Wide de municípios paraenses existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('segup-pa', `audit_${Date.now()}`, 'segup_pa_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "32. Armazenamento RAW da fonte SEGUP-PA com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SEGUP-PA',
    datasetId: 'indicadores_municipais_pa',
    rawFilePath: storedWide.path,
    originalFilename: 'segup_pa_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true,
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });
  assert(!!jobResult && !!jobResult.jobId, "33. Criação e agendamento de Job de Ingestão para SEGUP-PA");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "34. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('segup-pa-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "35. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 16, `36. 16 municípios do PA processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 128, `37. 128 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/segup-pa/segup_pa_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('segup-pa', `audit_vert_${Date.now()}`, 'segup_pa_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SEGUP-PA',
    datasetId: 'indicadores_municipais_pa',
    rawFilePath: storedVert.path,
    originalFilename: 'segup_pa_vertical_real.csv',
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
  assert(vertRunResult.success, "38. Processamento do Job SEGUP-PA (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "39. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/segup-pa/segup_pa_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('segup-pa', `audit_corrupt_${Date.now()}`, 'segup_pa_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SEGUP-PA',
    datasetId: 'indicadores_municipais_pa',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'segup_pa_corrupted_schema.csv',
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
  assert(!corruptRunResult.success, "40. Quality Gate: Rejeição automática de dataset com schema corrompido");
  assert(corruptRunResult.error?.includes('Quality Gate'), "41. Mensagem de erro explícita de violação do Quality Gate");

  // 10. Verificação no Banco de Dados Real
  const dbIndicators = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SEGUP-PA'));

  assert(dbIndicators.length === 136, `42. Verificação DB: Total de 136 registros consolidados (${dbIndicators.length} encontrados)`);

  const belemHomicide = dbIndicators.find(i => i.municipalityCode === '1501402' && i.category === 'homicide' && i.period === '2024-01');
  assert(belemHomicide?.value === 21, "43. Verificação DB: 21 vítimas de homicídio registradas em Belém no período 2024-01");

  const ananindeuaRobbery = dbIndicators.find(i => i.municipalityCode === '1500800' && i.category === 'robbery' && i.period === '2024-01');
  assert(ananindeuaRobbery?.value === 367, "44. Verificação DB: 367 roubos em Ananindeua (280 transeunte + 45 com + 18 res + 22 coletivo + 2 fluvial)");

  const santaremDrug = dbIndicators.find(i => i.municipalityCode === '1506807' && i.category === 'drug_related' && i.period === '2024-01');
  assert(santaremDrug?.value === 45, "45. Verificação DB: 45 ocorrências de drogas em Santarém");

  const marabaVeh = dbIndicators.find(i => i.municipalityCode === '1504208' && i.category === 'vehicle_robbery' && i.period === '2024-01');
  assert(marabaVeh?.value === 28, "46. Verificação DB: 28 roubos de veículos em Marabá");

  const parauapebasTheft = dbIndicators.find(i => i.municipalityCode === '1505536' && i.category === 'theft' && i.period === '2024-01');
  assert(parauapebasTheft?.value === 225, "47. Verificação DB: 225 furtos em Parauapebas");

  const castanhalArms = dbIndicators.find(i => i.municipalityCode === '1502400' && i.category === 'other' && i.period === '2024-01');
  assert(castanhalArms?.value === 16, "48. Verificação DB: 16 armas apreendidas em Castanhal");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SEGUP-PA',
    datasetId: 'indicadores_municipais_pa',
    rawFilePath: storedWide.path,
    originalFilename: 'segup_pa_municipios_wide_real.csv',
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
  assert(dupRunResult.success, "49. Re-execução do Job com mesmo dataset concluída com sucesso");

  const dbIndicatorsAfterDup = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SEGUP-PA'));

  assert(dbIndicatorsAfterDup.length === 136, "50. Idempotência: Contagem total inalterada no banco de dados (136 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'segup-pa'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "51. Status da fonte SEGUP-PA atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SEGUP-PA: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSegupPaAudit().catch(err => {
  console.error("Erro fatal na auditoria SEGUP-PA:", err);
  process.exit(1);
});
