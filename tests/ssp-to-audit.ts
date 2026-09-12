import { SspToAdapter } from '../src/ingestion/adapters/ssp-to/SspToAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSspToAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SSP-TO (TOCANTINS)                 ");
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

  // 0. Assegurar Fonte SSP-TO no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SSP-TO'));

  const toSource = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-to'`);
  if (toSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SSP-TO',
      name: 'Secretaria de Estado da Segurança Pública do Tocantins',
      provider: 'SSP-TO / Estatística',
      coverage: 'TO',
      state: 'TO',
      sourceType: 'csv',
      url: 'https://www.seguranca.to.gov.br/dados',
      officialUrl: 'https://www.seguranca.to.gov.br/',
      documentationUrl: 'https://to.gov.br/',
      description: 'Estatísticas de segurança pública e crimes violentos consolidados pela SSP-TO.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SspToAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SSP-TO' && meta.coverage === 'TO' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura de Tocantins");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SSP-TO' && discovery.url.includes('seguranca.to.gov.br'), "3. Discovery oficial apontando para repositório do Tocantins");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SSP-TO)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_TO_A', 'COLUNA_DESCONHECIDA_TO_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '1721000',
    municipio: 'Palmas',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '18',
    latrocinio: '2',
    feminicidio: '1',
    lesao_morte: '1',
    roubo_veiculo: '140',
    furto_veiculo: '100',
    roubo_transeunte: '600',
    roubo_comercio: '85',
    roubo_residencia: '38',
    roubo_coletivo: '35',
    furto: '750',
    estupro: '25',
    trafico_drogas: '180',
    apreensao_armas: '75'
  });

  const wideList = Array.isArray(parsedWide) ? parsedWide : [];
  assert(Array.isArray(parsedWide) && wideList.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = wideList.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 22 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios (CVLI): Soma correta (18 dolosos + 2 latrocínio + 1 feminicídio + 1 lesão morte = 22)");

  const robInd = wideList.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 758, "9. Indicador de Roubos (CVP): Agregação de Transeunte (600) + Comércio (85) + Residência (38) + Coletivo (35) = 758");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 140, "10. Indicador de Roubo de Veículos normalizado corretamente (140)");

  const vehTheftInd = wideList.find(r => r.data.category === 'vehicle_theft');
  assert(vehTheftInd?.data.value === 100, "11. Indicador de Furto de Veículos normalizado corretamente (100)");

  const theftInd = wideList.find(r => r.data.category === 'theft');
  assert(theftInd?.data.value === 750, "12. Indicador de Furtos Gerais normalizado corretamente (750)");

  const drugInd = wideList.find(r => r.data.category === 'drug_related');
  assert(drugInd?.data.value === 180, "13. Indicador de Tráfico de Entorpecentes normalizado corretamente (180)");

  const armsInd = wideList.find(r => r.data.category === 'other');
  assert(armsInd?.data.value === 75 && armsInd?.data.unit === 'armas', "14. Indicador de Apreensão de Armas de Fogo normalizado (75 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    cod_ibge: '1721000',
    municipio: 'Palmas',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Roubo em Ônibus',
    total: '32'
  });
  const vertList = Array.isArray(parsedVertical) ? parsedVertical : [];
  assert(Array.isArray(parsedVertical) && vertList.length === 1, "15. Parsing Vertical: Geração de indicador único");
  assert(vertList[0]?.data.category === 'robbery' && vertList[0]?.data.period === '2024-02', "16. Mapeamento correto de Roubo em Ônibus e mês por extenso");

  // 5. Mapeamento Canônico de Taxonomia Criminal
  assert(adapter.mapCrimeToCanonical('Crimes Violentos Letais Intencionais') === 'homicide', "17. Taxonomia: CVLI -> homicide");
  assert(adapter.mapCrimeToCanonical('Feminicídio') === 'homicide', "18. Taxonomia: Feminicídio -> homicide");
  assert(adapter.mapCrimeToCanonical('Roubo em Via Pública') === 'robbery', "19. Taxonomia: Roubo em Via Pública -> robbery");
  assert(adapter.mapCrimeToCanonical('Tentativa de Homicídio') === 'bodily_harm', "20. Taxonomia: Tentativa de Homicídio -> bodily_harm");
  assert(adapter.mapCrimeToCanonical('Estupro de Vulnerável') === 'sexual_crime', "21. Taxonomia: Estupro de Vulnerável -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Roubo de Carga') === 'cargo_theft', "22. Taxonomia: Roubo de Carga -> cargo_theft");

  // 6. Normalização Geográfica para Municípios Tocantinenses
  const pmwNorm = GeoNormalizationService.canonicalizeMunicipalityName('Palmas');
  assert(pmwNorm === 'palmas', "23. Geo Normalization: Palmas");

  const auxNorm = GeoNormalizationService.canonicalizeMunicipalityName('Araguaína');
  assert(auxNorm === 'araguaina', "24. Geo Normalization: Araguaína");

  const grpNorm = GeoNormalizationService.canonicalizeMunicipalityName('Gurupi');
  assert(grpNorm === 'gurupi', "25. Geo Normalization: Gurupi");

  const pnNorm = GeoNormalizationService.canonicalizeMunicipalityName('Porto Nacional');
  assert(pnNorm === 'porto nacional', "26. Geo Normalization: Porto Nacional");

  const parNorm = GeoNormalizationService.canonicalizeMunicipalityName('Paraíso do Tocantins');
  assert(parNorm === 'paraiso do tocantins', "27. Geo Normalization: Paraíso do Tocantins");

  const pmwAlias = GeoNormalizationService.canonicalizeMunicipalityName('PMW');
  assert(pmwAlias === 'palmas', "28. Geo Normalization: Alias 'PMW' -> 'palmas'");

  const auxAlias = GeoNormalizationService.canonicalizeMunicipalityName('AUX');
  assert(auxAlias === 'araguaina', "29. Geo Normalization: Alias 'AUX' -> 'araguaina'");

  const grpAlias = GeoNormalizationService.canonicalizeMunicipalityName('GRP');
  assert(grpAlias === 'gurupi', "30. Geo Normalization: Alias 'GRP' -> 'gurupi'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/ssp-to/ssp_to_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "31. Fixture CSV Wide de municípios tocantinenses existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('ssp-to', `audit_${Date.now()}`, 'ssp_to_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "32. Armazenamento RAW da fonte SSP-TO com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SSP-TO',
    datasetId: 'indicadores_municipais_to',
    rawFilePath: storedWide.path,
    originalFilename: 'ssp_to_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "33. Criação e agendamento de Job de Ingestão para SSP-TO");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "34. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('ssp-to-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "35. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 15, `36. 15 municípios do TO processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 120, `37. 120 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/ssp-to/ssp_to_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('ssp-to', `audit_vert_${Date.now()}`, 'ssp_to_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SSP-TO',
    datasetId: 'indicadores_municipais_to',
    rawFilePath: storedVert.path,
    originalFilename: 'ssp_to_vertical_real.csv',
    checksum: storedVert.metadata.checksum,
    fileSize: storedVert.metadata.size,
    force: true
  });

  const [dbVertJob] = await db.select().from(dataImports).where(eq(dataImports.id, vertJobResult.jobId));
  const vertRunResult = await worker.processJobDirectly(dbVertJob);
  assert(vertRunResult.success, "38. Processamento do Job SSP-TO (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "39. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/ssp-to/ssp_to_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('ssp-to', `audit_corrupt_${Date.now()}`, 'ssp_to_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SSP-TO',
    datasetId: 'indicadores_municipais_to',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'ssp_to_corrupted_schema.csv',
    checksum: storedCorrupt.metadata.checksum,
    fileSize: storedCorrupt.metadata.size,
    force: true
  });

  const [dbCorruptJob] = await db.select().from(dataImports).where(eq(dataImports.id, corruptJobResult.jobId));
  const corruptRunResult = await worker.processJobDirectly(dbCorruptJob);
  assert(!corruptRunResult.success, "40. Quality Gate: Rejeição automática de dataset com schema corrompido");
  assert(corruptRunResult.error?.includes('Quality Gate'), "41. Mensagem de erro explícita de violação do Quality Gate");

  // 10. Verificação no Banco de Dados Real
  const dbIndicators = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-TO'));

  assert(dbIndicators.length === 128, `42. Verificação DB: Total de 128 registros consolidados (${dbIndicators.length} encontrados)`);

  const pmwHomicide = dbIndicators.find(i => i.municipalityCode === '1721000' && i.category === 'homicide' && i.period === '2024-01');
  assert(pmwHomicide?.value === 22, "43. Verificação DB: 22 vítimas de homicídio registradas em Palmas no período 2024-01");

  const pmwRobbery = dbIndicators.find(i => i.municipalityCode === '1721000' && i.category === 'robbery' && i.period === '2024-01');
  assert(pmwRobbery?.value === 758, "44. Verificação DB: 758 roubos em Palmas (600 transeunte + 85 com + 38 res + 35 coletivo)");

  const auxRobbery = dbIndicators.find(i => i.municipalityCode === '1702109' && i.category === 'robbery' && i.period === '2024-01');
  assert(auxRobbery?.value === 477, "45. Verificação DB: 477 roubos em Araguaína");

  const grpDrugs = dbIndicators.find(i => i.municipalityCode === '1709500' && i.category === 'drug_related' && i.period === '2024-01');
  assert(grpDrugs?.value === 50, "46. Verificação DB: 50 ocorrências de drogas em Gurupi");

  const pnVehTheft = dbIndicators.find(i => i.municipalityCode === '1718204' && i.category === 'vehicle_theft' && i.period === '2024-01');
  assert(pnVehTheft?.value === 18, "47. Verificação DB: 18 furtos de veículos em Porto Nacional");

  const parArms = dbIndicators.find(i => i.municipalityCode === '1716109' && i.category === 'other' && i.period === '2024-01');
  assert(parArms?.value === 10, "48. Verificação DB: 10 armas apreendidas em Paraíso do Tocantins");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SSP-TO',
    datasetId: 'indicadores_municipais_to',
    rawFilePath: storedWide.path,
    originalFilename: 'ssp_to_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true
  });

  const [dbDupJob] = await db.select().from(dataImports).where(eq(dataImports.id, dupJobResult.jobId));
  const dupRunResult = await worker.processJobDirectly(dbDupJob);
  assert(dupRunResult.success, "49. Re-execução do Job com mesmo dataset concluída com sucesso");

  const dbIndicatorsAfterDup = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-TO'));

  assert(dbIndicatorsAfterDup.length === 128, "50. Idempotência: Contagem total inalterada no banco de dados (128 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-to'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "51. Status da fonte SSP-TO atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SSP-TO: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSspToAudit().catch(err => {
  console.error("Erro fatal na auditoria SSP-TO:", err);
  process.exit(1);
});
