import { SedsPbAdapter } from '../src/ingestion/adapters/seds-pb/SedsPbAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSedsPbAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SEDS-PB (PARAÍBA)                 ");
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

  // 0. Assegurar Fonte SEDS-PB no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SEDS-PB'));

  const pbSource = await db.select().from(dataSources).where(sql`lower(id) = 'seds-pb'`);
  if (pbSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SEDS-PB',
      name: 'Secretaria de Estado da Segurança e da Defesa Social da Paraíba',
      provider: 'SEDS-PB / GEAC',
      coverage: 'PB',
      state: 'PB',
      sourceType: 'csv',
      url: 'https://www.seguranca.pb.gov.br/estatisticas',
      officialUrl: 'https://www.seguranca.pb.gov.br/',
      documentationUrl: 'https://transparencia.pb.gov.br/',
      description: 'Estatísticas criminais consolidadas pela SEDS-PB e Gerência Executiva de Estatística e Análise Criminal.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SedsPbAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SEDS-PB' && meta.coverage === 'PB' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura da Paraíba");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SEDS-PB' && discovery.url.includes('seguranca.pb.gov.br'), "3. Discovery oficial apontando para repositório da Paraíba");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SEDS-PB)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_PB_A', 'COLUNA_DESCONHECIDA_PB_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '2507507',
    municipio: 'João Pessoa',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '22',
    latrocinio: '2',
    feminicidio: '1',
    lesao_morte: '1',
    roubo_veiculo: '110',
    furto_veiculo: '95',
    roubo_transeunte: '540',
    roubo_comercio: '92',
    roubo_residencia: '34',
    roubo_coletivo: '42',
    furto: '820',
    estupro: '28',
    trafico_drogas: '180',
    apreensao_armas: '72'
  });

  const wideList = Array.isArray(parsedWide) ? parsedWide : [];
  assert(Array.isArray(parsedWide) && wideList.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = wideList.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 26 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios (CVLI): Soma correta (22 dolosos + 2 latrocínio + 1 feminicídio + 1 lesão morte = 26)");

  const robInd = wideList.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 708, "9. Indicador de Roubos (CVP): Agregação de Transeunte (540) + Comércio (92) + Residência (34) + Coletivo (42) = 708");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 110, "10. Indicador de Roubo de Veículos normalizado corretamente (110)");

  const vehTheftInd = wideList.find(r => r.data.category === 'vehicle_theft');
  assert(vehTheftInd?.data.value === 95, "11. Indicador de Furto de Veículos normalizado corretamente (95)");

  const theftInd = wideList.find(r => r.data.category === 'theft');
  assert(theftInd?.data.value === 820, "12. Indicador de Furtos Gerais normalizado corretamente (820)");

  const drugInd = wideList.find(r => r.data.category === 'drug_related');
  assert(drugInd?.data.value === 180, "13. Indicador de Tráfico de Entorpecentes normalizado corretamente (180)");

  const armsInd = wideList.find(r => r.data.category === 'other');
  assert(armsInd?.data.value === 72 && armsInd?.data.unit === 'armas', "14. Indicador de Apreensão de Armas de Fogo normalizado (72 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    cod_ibge: '2507507',
    municipio: 'João Pessoa',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Roubo em Ônibus',
    total: '38'
  });
  const vertList = Array.isArray(parsedVertical) ? parsedVertical : [];
  assert(Array.isArray(parsedVertical) && vertList.length === 1, "15. Parsing Vertical: Geração de indicador único");
  assert(vertList[0]?.data.category === 'robbery' && vertList[0]?.data.period === '2024-02', "16. Mapeamento correto de Roubo em Ônibus e mês por extenso");

  // 5. Mapeamento Canônico de Taxonomia Criminal
  assert(adapter.mapCrimeToCanonical('Crimes Violentos Letais Intencionais') === 'homicide', "17. Taxonomia: CVLI -> homicide");
  assert(adapter.mapCrimeToCanonical('Feminicídio') === 'homicide', "18. Taxonomia: Feminicídio -> homicide");
  assert(adapter.mapCrimeToCanonical('Roubo em Transporte Coletivo') === 'robbery', "19. Taxonomia: Roubo em Coletivo -> robbery");
  assert(adapter.mapCrimeToCanonical('Tentativa de Homicídio') === 'bodily_harm', "20. Taxonomia: Tentativa de Homicídio -> bodily_harm");
  assert(adapter.mapCrimeToCanonical('Estupro de Vulnerável') === 'sexual_crime', "21. Taxonomia: Estupro de Vulnerável -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Roubo de Carga') === 'cargo_theft', "22. Taxonomia: Roubo de Carga -> cargo_theft");

  // 6. Normalização Geográfica para Municípios Paraibanos
  const jpaNorm = GeoNormalizationService.canonicalizeMunicipalityName('João Pessoa');
  assert(jpaNorm === 'joao pessoa', "23. Geo Normalization: João Pessoa");

  const cgNorm = GeoNormalizationService.canonicalizeMunicipalityName('Campina Grande');
  assert(cgNorm === 'campina grande', "24. Geo Normalization: Campina Grande");

  const srNorm = GeoNormalizationService.canonicalizeMunicipalityName('Santa Rita');
  assert(srNorm === 'santa rita', "25. Geo Normalization: Santa Rita");

  const patosNorm = GeoNormalizationService.canonicalizeMunicipalityName('Patos');
  assert(patosNorm === 'patos', "26. Geo Normalization: Patos");

  const bayeuxNorm = GeoNormalizationService.canonicalizeMunicipalityName('Bayeux');
  assert(bayeuxNorm === 'bayeux', "27. Geo Normalization: Bayeux");

  const jampaAlias = GeoNormalizationService.canonicalizeMunicipalityName('Jampa');
  assert(jampaAlias === 'joao pessoa', "28. Geo Normalization: Alias 'Jampa' -> 'joao pessoa'");

  const jpaAlias = GeoNormalizationService.canonicalizeMunicipalityName('JPA');
  assert(jpaAlias === 'joao pessoa', "29. Geo Normalization: Alias 'JPA' -> 'joao pessoa'");

  const staRitaAlias = GeoNormalizationService.canonicalizeMunicipalityName('Sta. Rita');
  assert(staRitaAlias === 'santa rita', "30. Geo Normalization: Alias 'Sta. Rita' -> 'santa rita'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/seds-pb/seds_pb_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "31. Fixture CSV Wide de municípios paraibanos existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('seds-pb', `audit_${Date.now()}`, 'seds_pb_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "32. Armazenamento RAW da fonte SEDS-PB com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SEDS-PB',
    datasetId: 'indicadores_municipais_pb',
    rawFilePath: storedWide.path,
    originalFilename: 'seds_pb_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "33. Criação e agendamento de Job de Ingestão para SEDS-PB");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "34. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('seds-pb-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "35. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 16, `36. 16 municípios da PB processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 128, `37. 128 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/seds-pb/seds_pb_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('seds-pb', `audit_vert_${Date.now()}`, 'seds_pb_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SEDS-PB',
    datasetId: 'indicadores_municipais_pb',
    rawFilePath: storedVert.path,
    originalFilename: 'seds_pb_vertical_real.csv',
    checksum: storedVert.metadata.checksum,
    fileSize: storedVert.metadata.size,
    force: true
  });

  const [dbVertJob] = await db.select().from(dataImports).where(eq(dataImports.id, vertJobResult.jobId));
  const vertRunResult = await worker.processJobDirectly(dbVertJob);
  assert(vertRunResult.success, "38. Processamento do Job SEDS-PB (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "39. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/seds-pb/seds_pb_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('seds-pb', `audit_corrupt_${Date.now()}`, 'seds_pb_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SEDS-PB',
    datasetId: 'indicadores_municipais_pb',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'seds_pb_corrupted_schema.csv',
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
    .where(eq(securityIndicators.sourceId, 'SEDS-PB'));

  assert(dbIndicators.length === 136, `42. Verificação DB: Total de 136 registros consolidados (${dbIndicators.length} encontrados)`);

  const jpaHomicide = dbIndicators.find(i => i.municipalityCode === '2507507' && i.category === 'homicide' && i.period === '2024-01');
  assert(jpaHomicide?.value === 26, "43. Verificação DB: 26 vítimas de homicídio registradas em João Pessoa no período 2024-01");

  const jpaRobbery = dbIndicators.find(i => i.municipalityCode === '2507507' && i.category === 'robbery' && i.period === '2024-01');
  assert(jpaRobbery?.value === 708, "44. Verificação DB: 708 roubos em João Pessoa (540 transeunte + 92 com + 34 res + 42 coletivo)");

  const cgRobbery = dbIndicators.find(i => i.municipalityCode === '2504009' && i.category === 'robbery' && i.period === '2024-01');
  assert(cgRobbery?.value === 339, "45. Verificação DB: 339 roubos em Campina Grande");

  const bayeuxDrug = dbIndicators.find(i => i.municipalityCode === '2501807' && i.category === 'drug_related' && i.period === '2024-01');
  assert(bayeuxDrug?.value === 44, "46. Verificação DB: 44 ocorrências de drogas em Bayeux");

  const patosVeh = dbIndicators.find(i => i.municipalityCode === '2510808' && i.category === 'vehicle_robbery' && i.period === '2024-01');
  assert(patosVeh?.value === 22, "47. Verificação DB: 22 roubos de veículos em Patos");

  const srTheft = dbIndicators.find(i => i.municipalityCode === '2513703' && i.category === 'theft' && i.period === '2024-01');
  assert(srTheft?.value === 190, "48. Verificação DB: 190 furtos em Santa Rita");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SEDS-PB',
    datasetId: 'indicadores_municipais_pb',
    rawFilePath: storedWide.path,
    originalFilename: 'seds_pb_municipios_wide_real.csv',
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
    .where(eq(securityIndicators.sourceId, 'SEDS-PB'));

  assert(dbIndicatorsAfterDup.length === 136, "50. Idempotência: Contagem total inalterada no banco de dados (136 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'seds-pb'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "51. Status da fonte SEDS-PB atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SEDS-PB: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSedsPbAudit().catch(err => {
  console.error("Erro fatal na auditoria SEDS-PB:", err);
  process.exit(1);
});
