import { SejuspMsAdapter } from '../src/ingestion/adapters/sejusp-ms/SejuspMsAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSejuspMsAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SEJUSP-MS (MATO GROSSO DO SUL)    ");
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

  // 0. Assegurar Fonte SEJUSP-MS no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SEJUSP-MS'));

  const msSource = await db.select().from(dataSources).where(sql`lower(id) = 'sejusp-ms'`);
  if (msSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SEJUSP-MS',
      name: 'Secretaria de Estado de Justiça e Segurança Pública de Mato Grosso do Sul',
      provider: 'SEJUSP-MS / Estatística',
      coverage: 'MS',
      state: 'MS',
      sourceType: 'csv',
      url: 'https://www.sejusp.ms.gov.br/dados',
      officialUrl: 'https://www.sejusp.ms.gov.br/',
      documentationUrl: 'https://transparencia.ms.gov.br/',
      description: 'Estatísticas de segurança pública e crimes violentos consolidados pela SEJUSP-MS.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SejuspMsAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SEJUSP-MS' && meta.coverage === 'MS' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura de Mato Grosso do Sul");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SEJUSP-MS' && discovery.url.includes('sejusp.ms.gov.br'), "3. Discovery oficial apontando para repositório do MS");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SEJUSP-MS)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_MS_A', 'COLUNA_DESCONHECIDA_MS_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '5002704',
    municipio: 'Campo Grande',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '32',
    latrocinio: '3',
    feminicidio: '2',
    lesao_morte: '1',
    roubo_veiculo: '210',
    furto_veiculo: '160',
    roubo_transeunte: '850',
    roubo_comercio: '135',
    roubo_residencia: '55',
    roubo_coletivo: '70',
    furto: '1100',
    estupro: '40',
    trafico_drogas: '280',
    apreensao_armas: '110'
  });

  const wideList = Array.isArray(parsedWide) ? parsedWide : [];
  assert(Array.isArray(parsedWide) && wideList.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = wideList.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 38 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios (CVLI): Soma correta (32 dolosos + 3 latrocínio + 2 feminicídio + 1 lesão morte = 38)");

  const robInd = wideList.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 1110, "9. Indicador de Roubos (CVP): Agregação de Transeunte (850) + Comércio (135) + Residência (55) + Coletivo (70) = 1110");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 210, "10. Indicador de Roubo de Veículos normalizado corretamente (210)");

  const vehTheftInd = wideList.find(r => r.data.category === 'vehicle_theft');
  assert(vehTheftInd?.data.value === 160, "11. Indicador de Furto de Veículos normalizado corretamente (160)");

  const theftInd = wideList.find(r => r.data.category === 'theft');
  assert(theftInd?.data.value === 1100, "12. Indicador de Furtos Gerais normalizado corretamente (1100)");

  const drugInd = wideList.find(r => r.data.category === 'drug_related');
  assert(drugInd?.data.value === 280, "13. Indicador de Tráfico de Entorpecentes normalizado corretamente (280)");

  const armsInd = wideList.find(r => r.data.category === 'other');
  assert(armsInd?.data.value === 110 && armsInd?.data.unit === 'armas', "14. Indicador de Apreensão de Armas de Fogo normalizado (110 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    cod_ibge: '5002704',
    municipio: 'Campo Grande',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Roubo em Ônibus',
    total: '62'
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

  // 6. Normalização Geográfica para Municípios Sul-matogrossenses
  const cgNorm = GeoNormalizationService.canonicalizeMunicipalityName('Campo Grande');
  assert(cgNorm === 'campo grande', "23. Geo Normalization: Campo Grande");

  const douNorm = GeoNormalizationService.canonicalizeMunicipalityName('Dourados');
  assert(douNorm === 'dourados', "24. Geo Normalization: Dourados");

  const tlNorm = GeoNormalizationService.canonicalizeMunicipalityName('Três Lagoas');
  assert(tlNorm === 'tres lagoas', "25. Geo Normalization: Três Lagoas");

  const corNorm = GeoNormalizationService.canonicalizeMunicipalityName('Corumbá');
  assert(corNorm === 'corumba', "26. Geo Normalization: Corumbá");

  const ppNorm = GeoNormalizationService.canonicalizeMunicipalityName('Ponta Porã');
  assert(ppNorm === 'ponta pora', "27. Geo Normalization: Ponta Porã");

  const cgAlias = GeoNormalizationService.canonicalizeMunicipalityName('CG');
  assert(cgAlias === 'campo grande', "28. Geo Normalization: Alias 'CG' -> 'campo grande'");

  const douAlias = GeoNormalizationService.canonicalizeMunicipalityName('DOU');
  assert(douAlias === 'dourados', "29. Geo Normalization: Alias 'DOU' -> 'dourados'");

  const corAlias = GeoNormalizationService.canonicalizeMunicipalityName('COR');
  assert(corAlias === 'corumba', "30. Geo Normalization: Alias 'COR' -> 'corumba'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/sejusp-ms/sejusp_ms_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "31. Fixture CSV Wide de municípios sul-matogrossenses existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('sejusp-ms', `audit_${Date.now()}`, 'sejusp_ms_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "32. Armazenamento RAW da fonte SEJUSP-MS com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SEJUSP-MS',
    datasetId: 'indicadores_municipais_ms',
    rawFilePath: storedWide.path,
    originalFilename: 'sejusp_ms_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "33. Criação e agendamento de Job de Ingestão para SEJUSP-MS");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "34. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('sejusp-ms-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "35. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 18, `36. 18 municípios de MS processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 144, `37. 144 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/sejusp-ms/sejusp_ms_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('sejusp-ms', `audit_vert_${Date.now()}`, 'sejusp_ms_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SEJUSP-MS',
    datasetId: 'indicadores_municipais_ms',
    rawFilePath: storedVert.path,
    originalFilename: 'sejusp_ms_vertical_real.csv',
    checksum: storedVert.metadata.checksum,
    fileSize: storedVert.metadata.size,
    force: true
  });

  const [dbVertJob] = await db.select().from(dataImports).where(eq(dataImports.id, vertJobResult.jobId));
  const vertRunResult = await worker.processJobDirectly(dbVertJob);
  assert(vertRunResult.success, "38. Processamento do Job SEJUSP-MS (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "39. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/sejusp-ms/sejusp_ms_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('sejusp-ms', `audit_corrupt_${Date.now()}`, 'sejusp_ms_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SEJUSP-MS',
    datasetId: 'indicadores_municipais_ms',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'sejusp_ms_corrupted_schema.csv',
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
    .where(eq(securityIndicators.sourceId, 'SEJUSP-MS'));

  assert(dbIndicators.length === 152, `42. Verificação DB: Total de 152 registros consolidados (${dbIndicators.length} encontrados)`);

  const cgHomicide = dbIndicators.find(i => i.municipalityCode === '5002704' && i.category === 'homicide' && i.period === '2024-01');
  assert(cgHomicide?.value === 38, "43. Verificação DB: 38 vítimas de homicídio registradas em Campo Grande no período 2024-01");

  const cgRobbery = dbIndicators.find(i => i.municipalityCode === '5002704' && i.category === 'robbery' && i.period === '2024-01');
  assert(cgRobbery?.value === 1110, "44. Verificação DB: 1110 roubos em Campo Grande (850 transeunte + 135 com + 55 res + 70 coletivo)");

  const douRobbery = dbIndicators.find(i => i.municipalityCode === '5003702' && i.category === 'robbery' && i.period === '2024-01');
  assert(douRobbery?.value === 487, "45. Verificação DB: 487 roubos em Dourados");

  const ppDrugs = dbIndicators.find(i => i.municipalityCode === '5006608' && i.category === 'drug_related' && i.period === '2024-01');
  assert(ppDrugs?.value === 190, "46. Verificação DB: 190 ocorrências de drogas em Ponta Porã");

  const tlVehTheft = dbIndicators.find(i => i.municipalityCode === '5008305' && i.category === 'vehicle_theft' && i.period === '2024-01');
  assert(tlVehTheft?.value === 42, "47. Verificação DB: 42 furtos de veículos em Três Lagoas");

  const corArms = dbIndicators.find(i => i.municipalityCode === '5003207' && i.category === 'other' && i.period === '2024-01');
  assert(corArms?.value === 22, "48. Verificação DB: 22 armas apreendidas em Corumbá");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SEJUSP-MS',
    datasetId: 'indicadores_municipais_ms',
    rawFilePath: storedWide.path,
    originalFilename: 'sejusp_ms_municipios_wide_real.csv',
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
    .where(eq(securityIndicators.sourceId, 'SEJUSP-MS'));

  assert(dbIndicatorsAfterDup.length === 152, "50. Idempotência: Contagem total inalterada no banco de dados (152 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'sejusp-ms'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "51. Status da fonte SEJUSP-MS atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SEJUSP-MS: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSejuspMsAudit().catch(err => {
  console.error("Erro fatal na auditoria SEJUSP-MS:", err);
  process.exit(1);
});
