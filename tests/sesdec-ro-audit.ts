import { SesdecRoAdapter } from '../src/ingestion/adapters/sesdec-ro/SesdecRoAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSesdecRoAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SESDEC-RO (RONDÔNIA)              ");
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

  // 0. Assegurar Fonte SESDEC-RO no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SESDEC-RO'));

  const roSource = await db.select().from(dataSources).where(sql`lower(id) = 'sesdec-ro'`);
  if (roSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SESDEC-RO',
      name: 'Secretaria de Estado da Segurança, Defesa e Cidadania de Rondônia',
      provider: 'SESDEC-RO / Estatística',
      coverage: 'RO',
      state: 'RO',
      sourceType: 'csv',
      url: 'https://www.seguranca.ro.gov.br/dados',
      officialUrl: 'https://www.seguranca.ro.gov.br/',
      documentationUrl: 'https://rondonia.ro.gov.br/',
      description: 'Estatísticas de segurança pública e crimes violentos consolidados pela SESDEC-RO.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SesdecRoAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SESDEC-RO' && meta.coverage === 'RO' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura de Rondônia");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SESDEC-RO' && discovery.url.includes('seguranca.ro.gov.br'), "3. Discovery oficial apontando para repositório de Rondônia");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SESDEC-RO)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_RO_A', 'COLUNA_DESCONHECIDA_RO_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '1100205',
    municipio: 'Porto Velho',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '28',
    latrocinio: '2',
    feminicidio: '2',
    lesao_morte: '1',
    roubo_veiculo: '180',
    furto_veiculo: '140',
    roubo_transeunte: '720',
    roubo_comercio: '110',
    roubo_residencia: '48',
    roubo_coletivo: '55',
    furto: '920',
    estupro: '35',
    trafico_drogas: '240',
    apreensao_armas: '95'
  });

  const wideList = Array.isArray(parsedWide) ? parsedWide : [];
  assert(Array.isArray(parsedWide) && wideList.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = wideList.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 33 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios (CVLI): Soma correta (28 dolosos + 2 latrocínio + 2 feminicídio + 1 lesão morte = 33)");

  const robInd = wideList.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 933, "9. Indicador de Roubos (CVP): Agregação de Transeunte (720) + Comércio (110) + Residência (48) + Coletivo (55) = 933");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 180, "10. Indicador de Roubo de Veículos normalizado corretamente (180)");

  const vehTheftInd = wideList.find(r => r.data.category === 'vehicle_theft');
  assert(vehTheftInd?.data.value === 140, "11. Indicador de Furto de Veículos normalizado corretamente (140)");

  const theftInd = wideList.find(r => r.data.category === 'theft');
  assert(theftInd?.data.value === 920, "12. Indicador de Furtos Gerais normalizado corretamente (920)");

  const drugInd = wideList.find(r => r.data.category === 'drug_related');
  assert(drugInd?.data.value === 240, "13. Indicador de Tráfico de Entorpecentes normalizado corretamente (240)");

  const armsInd = wideList.find(r => r.data.category === 'other');
  assert(armsInd?.data.value === 95 && armsInd?.data.unit === 'armas', "14. Indicador de Apreensão de Armas de Fogo normalizado (95 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    cod_ibge: '1100205',
    municipio: 'Porto Velho',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Roubo em Ônibus',
    total: '50'
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

  // 6. Normalização Geográfica para Municípios Rondonienses
  const pvhNorm = GeoNormalizationService.canonicalizeMunicipalityName('Porto Velho');
  assert(pvhNorm === 'porto velho', "23. Geo Normalization: Porto Velho");

  const jipNorm = GeoNormalizationService.canonicalizeMunicipalityName('Ji-Paraná');
  assert(jipNorm === 'ji parana', "24. Geo Normalization: Ji-Paraná");

  const arqNorm = GeoNormalizationService.canonicalizeMunicipalityName('Ariquemes');
  assert(arqNorm === 'ariquemes', "25. Geo Normalization: Ariquemes");

  const vhaNorm = GeoNormalizationService.canonicalizeMunicipalityName('Vilhena');
  assert(vhaNorm === 'vilhena', "26. Geo Normalization: Vilhena");

  const cacNorm = GeoNormalizationService.canonicalizeMunicipalityName('Cacoal');
  assert(cacNorm === 'cacoal', "27. Geo Normalization: Cacoal");

  const pvhAlias = GeoNormalizationService.canonicalizeMunicipalityName('PVH');
  assert(pvhAlias === 'porto velho', "28. Geo Normalization: Alias 'PVH' -> 'porto velho'");

  const jipAlias = GeoNormalizationService.canonicalizeMunicipalityName('JIP');
  assert(jipAlias === 'ji parana', "29. Geo Normalization: Alias 'JIP' -> 'ji parana'");

  const vhaAlias = GeoNormalizationService.canonicalizeMunicipalityName('VHA');
  assert(vhaAlias === 'vilhena', "30. Geo Normalization: Alias 'VHA' -> 'vilhena'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/sesdec-ro/sesdec_ro_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "31. Fixture CSV Wide de municípios rondonienses existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('sesdec-ro', `audit_${Date.now()}`, 'sesdec_ro_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "32. Armazenamento RAW da fonte SESDEC-RO com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SESDEC-RO',
    datasetId: 'indicadores_municipais_ro',
    rawFilePath: storedWide.path,
    originalFilename: 'sesdec_ro_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "33. Criação e agendamento de Job de Ingestão para SESDEC-RO");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "34. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('sesdec-ro-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "35. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 18, `36. 18 municípios de RO processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 144, `37. 144 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/sesdec-ro/sesdec_ro_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('sesdec-ro', `audit_vert_${Date.now()}`, 'sesdec_ro_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SESDEC-RO',
    datasetId: 'indicadores_municipais_ro',
    rawFilePath: storedVert.path,
    originalFilename: 'sesdec_ro_vertical_real.csv',
    checksum: storedVert.metadata.checksum,
    fileSize: storedVert.metadata.size,
    force: true
  });

  const [dbVertJob] = await db.select().from(dataImports).where(eq(dataImports.id, vertJobResult.jobId));
  const vertRunResult = await worker.processJobDirectly(dbVertJob);
  assert(vertRunResult.success, "38. Processamento do Job SESDEC-RO (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "39. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/sesdec-ro/sesdec_ro_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('sesdec-ro', `audit_corrupt_${Date.now()}`, 'sesdec_ro_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SESDEC-RO',
    datasetId: 'indicadores_municipais_ro',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'sesdec_ro_corrupted_schema.csv',
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
    .where(eq(securityIndicators.sourceId, 'SESDEC-RO'));

  assert(dbIndicators.length === 152, `42. Verificação DB: Total de 152 registros consolidados (${dbIndicators.length} encontrados)`);

  const pvhHomicide = dbIndicators.find(i => i.municipalityCode === '1100205' && i.category === 'homicide' && i.period === '2024-01');
  assert(pvhHomicide?.value === 33, "43. Verificação DB: 33 vítimas de homicídio registradas em Porto Velho no período 2024-01");

  const pvhRobbery = dbIndicators.find(i => i.municipalityCode === '1100205' && i.category === 'robbery' && i.period === '2024-01');
  assert(pvhRobbery?.value === 933, "44. Verificação DB: 933 roubos em Porto Velho (720 transeunte + 110 com + 48 res + 55 coletivo)");

  const jipRobbery = dbIndicators.find(i => i.municipalityCode === '1100122' && i.category === 'robbery' && i.period === '2024-01');
  assert(jipRobbery?.value === 371, "45. Verificação DB: 371 roubos em Ji-Paraná");

  const cacDrugs = dbIndicators.find(i => i.municipalityCode === '1100049' && i.category === 'drug_related' && i.period === '2024-01');
  assert(cacDrugs?.value === 55, "46. Verificação DB: 55 ocorrências de drogas em Cacoal");

  const vhaVehTheft = dbIndicators.find(i => i.municipalityCode === '1100304' && i.category === 'vehicle_theft' && i.period === '2024-01');
  assert(vhaVehTheft?.value === 38, "47. Verificação DB: 38 furtos de veículos em Vilhena");

  const arqArms = dbIndicators.find(i => i.municipalityCode === '1100023' && i.category === 'other' && i.period === '2024-01');
  assert(arqArms?.value === 25, "48. Verificação DB: 25 armas apreendidas em Ariquemes");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SESDEC-RO',
    datasetId: 'indicadores_municipais_ro',
    rawFilePath: storedWide.path,
    originalFilename: 'sesdec_ro_municipios_wide_real.csv',
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
    .where(eq(securityIndicators.sourceId, 'SESDEC-RO'));

  assert(dbIndicatorsAfterDup.length === 152, "50. Idempotência: Contagem total inalterada no banco de dados (152 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'sesdec-ro'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "51. Status da fonte SESDEC-RO atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SESDEC-RO: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSesdecRoAudit().catch(err => {
  console.error("Erro fatal na auditoria SESDEC-RO:", err);
  process.exit(1);
});
