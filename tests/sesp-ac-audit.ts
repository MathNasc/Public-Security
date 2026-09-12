import { SespAcAdapter } from '../src/ingestion/adapters/sesp-ac/SespAcAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSespAcAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SESP-AC (ACRE)                    ");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details || 'Condição não satisfeito'}`);
      failed++;
    }
  }

  // 0. Assegurar Fonte SESP-AC no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SESP-AC'));

  const acSource = await db.select().from(dataSources).where(sql`lower(id) = 'sesp-ac'`);
  if (acSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SESP-AC',
      name: 'Secretaria de Estado de Justiça e Segurança Pública do Acre',
      provider: 'SESP-AC / Estatística',
      coverage: 'AC',
      state: 'AC',
      sourceType: 'csv',
      url: 'https://www.seguranca.ac.gov.br/dados',
      officialUrl: 'https://www.seguranca.ac.gov.br/',
      documentationUrl: 'https://ac.gov.br/',
      description: 'Estatísticas de segurança pública e crimes violentos consolidados pela SESP-AC.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SespAcAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SESP-AC' && meta.coverage === 'AC' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do Acre");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SESP-AC' && discovery.url.includes('seguranca.ac.gov.br'), "3. Discovery oficial apontando para repositório do Acre");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SESP-AC)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_AC_A', 'COLUNA_DESCONHECIDA_AC_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '1200401',
    municipio: 'Rio Branco',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '22',
    latrocinio: '2',
    feminicidio: '1',
    lesao_morte: '1',
    roubo_veiculo: '160',
    furto_veiculo: '120',
    roubo_transeunte: '680',
    roubo_comercio: '95',
    roubo_residencia: '42',
    roubo_coletivo: '48',
    furto: '850',
    estupro: '30',
    trafico_drogas: '210',
    apreensao_armas: '85'
  });

  const wideList = Array.isArray(parsedWide) ? parsedWide : [];
  assert(Array.isArray(parsedWide) && wideList.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = wideList.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 26 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios (CVLI): Soma correta (22 dolosos + 2 latrocínio + 1 feminicídio + 1 lesão morte = 26)");

  const robInd = wideList.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 865, "9. Indicador de Roubos (CVP): Agregação de Transeunte (680) + Comércio (95) + Residência (42) + Coletivo (48) = 865");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 160, "10. Indicador de Roubo de Veículos normalizado corretamente (160)");

  const vehTheftInd = wideList.find(r => r.data.category === 'vehicle_theft');
  assert(vehTheftInd?.data.value === 120, "11. Indicador de Furto de Veículos normalizado corretamente (120)");

  const theftInd = wideList.find(r => r.data.category === 'theft');
  assert(theftInd?.data.value === 850, "12. Indicador de Furtos Gerais normalizado corretamente (850)");

  const drugInd = wideList.find(r => r.data.category === 'drug_related');
  assert(drugInd?.data.value === 210, "13. Indicador de Tráfico de Entorpecentes normalizado corretamente (210)");

  const armsInd = wideList.find(r => r.data.category === 'other');
  assert(armsInd?.data.value === 85 && armsInd?.data.unit === 'armas', "14. Indicador de Apreensão de Armas de Fogo normalizado (85 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    cod_ibge: '1200401',
    municipio: 'Rio Branco',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Roubo em Ônibus',
    total: '45'
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

  // 6. Normalização Geográfica para Municípios Acreanos
  const rbNorm = GeoNormalizationService.canonicalizeMunicipalityName('Rio Branco');
  assert(rbNorm === 'rio branco', "23. Geo Normalization: Rio Branco");

  const czsNorm = GeoNormalizationService.canonicalizeMunicipalityName('Cruzeiro do Sul');
  assert(czsNorm === 'cruzeiro do sul', "24. Geo Normalization: Cruzeiro do Sul");

  const smNorm = GeoNormalizationService.canonicalizeMunicipalityName('Sena Madureira');
  assert(smNorm === 'sena madureira', "25. Geo Normalization: Sena Madureira");

  const tarNorm = GeoNormalizationService.canonicalizeMunicipalityName('Tarauacá');
  assert(tarNorm === 'tarauaca', "26. Geo Normalization: Tarauacá");

  const fjNorm = GeoNormalizationService.canonicalizeMunicipalityName('Feijó');
  assert(fjNorm === 'feijo', "27. Geo Normalization: Feijó");

  const rbAlias = GeoNormalizationService.canonicalizeMunicipalityName('RB');
  assert(rbAlias === 'rio branco', "28. Geo Normalization: Alias 'RB' -> 'rio branco'");

  const czsAlias = GeoNormalizationService.canonicalizeMunicipalityName('CZS');
  assert(czsAlias === 'cruzeiro do sul', "29. Geo Normalization: Alias 'CZS' -> 'cruzeiro do sul'");

  const smAlias = GeoNormalizationService.canonicalizeMunicipalityName('S Madureira');
  assert(smAlias === 'sena madureira', "30. Geo Normalization: Alias 'S Madureira' -> 'sena madureira'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/sesp-ac/sesp_ac_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "31. Fixture CSV Wide de municípios acreanos existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('sesp-ac', `audit_${Date.now()}`, 'sesp_ac_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "32. Armazenamento RAW da fonte SESP-AC com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SESP-AC',
    datasetId: 'indicadores_municipais_ac',
    rawFilePath: storedWide.path,
    originalFilename: 'sesp_ac_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "33. Criação e agendamento de Job de Ingestão para SESP-AC");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "34. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('sesp-ac-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "35. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 18, `36. 18 municípios do AC processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 144, `37. 144 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/sesp-ac/sesp_ac_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('sesp-ac', `audit_vert_${Date.now()}`, 'sesp_ac_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SESP-AC',
    datasetId: 'indicadores_municipais_ac',
    rawFilePath: storedVert.path,
    originalFilename: 'sesp_ac_vertical_real.csv',
    checksum: storedVert.metadata.checksum,
    fileSize: storedVert.metadata.size,
    force: true
  });

  const [dbVertJob] = await db.select().from(dataImports).where(eq(dataImports.id, vertJobResult.jobId));
  const vertRunResult = await worker.processJobDirectly(dbVertJob);
  assert(vertRunResult.success, "38. Processamento do Job SESP-AC (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "39. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/sesp-ac/sesp_ac_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('sesp-ac', `audit_corrupt_${Date.now()}`, 'sesp_ac_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SESP-AC',
    datasetId: 'indicadores_municipais_ac',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'sesp_ac_corrupted_schema.csv',
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
    .where(eq(securityIndicators.sourceId, 'SESP-AC'));

  assert(dbIndicators.length === 152, `42. Verificação DB: Total de 152 registros consolidados (${dbIndicators.length} encontrados)`);

  const rbHomicide = dbIndicators.find(i => i.municipalityCode === '1200401' && i.category === 'homicide' && i.period === '2024-01');
  assert(rbHomicide?.value === 26, "43. Verificação DB: 26 vítimas de homicídio registradas em Rio Branco no período 2024-01");

  const rbRobbery = dbIndicators.find(i => i.municipalityCode === '1200401' && i.category === 'robbery' && i.period === '2024-01');
  assert(rbRobbery?.value === 865, "44. Verificação DB: 865 roubos em Rio Branco (680 transeunte + 95 com + 42 res + 48 coletivo)");

  const czsRobbery = dbIndicators.find(i => i.municipalityCode === '1200203' && i.category === 'robbery' && i.period === '2024-01');
  assert(czsRobbery?.value === 307, "45. Verificação DB: 307 roubos em Cruzeiro do Sul");

  const braDrugs = dbIndicators.find(i => i.municipalityCode === '1200104' && i.category === 'drug_related' && i.period === '2024-01');
  assert(braDrugs?.value === 52, "46. Verificação DB: 52 ocorrências de drogas em Brasiléia");

  const smVehTheft = dbIndicators.find(i => i.municipalityCode === '1200500' && i.category === 'vehicle_theft' && i.period === '2024-01');
  assert(smVehTheft?.value === 25, "47. Verificação DB: 25 furtos de veículos em Sena Madureira");

  const tarArms = dbIndicators.find(i => i.municipalityCode === '1200609' && i.category === 'other' && i.period === '2024-01');
  assert(tarArms?.value === 12, "48. Verificação DB: 12 armas apreendidas em Tarauacá");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SESP-AC',
    datasetId: 'indicadores_municipais_ac',
    rawFilePath: storedWide.path,
    originalFilename: 'sesp_ac_municipios_wide_real.csv',
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
    .where(eq(securityIndicators.sourceId, 'SESP-AC'));

  assert(dbIndicatorsAfterDup.length === 152, "50. Idempotência: Contagem total inalterada no banco de dados (152 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'sesp-ac'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "51. Status da fonte SESP-AC atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SESP-AC: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSespAcAudit().catch(err => {
  console.error("Erro fatal na auditoria SESP-AC:", err);
  process.exit(1);
});
