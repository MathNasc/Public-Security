import { SspSeAdapter } from '../src/ingestion/adapters/ssp-se/SspSeAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSspSeAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SSP-SE (SERGIPE)                  ");
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

  // 0. Assegurar Fonte SSP-SE no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SSP-SE'));

  const seSource = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-se'`);
  if (seSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SSP-SE',
      name: 'Secretaria de Estado da Segurança Pública de Sergipe',
      provider: 'SSP-SE / CEACRIM',
      coverage: 'SE',
      state: 'SE',
      sourceType: 'csv',
      url: 'https://dados.se.gov.br/dataset/seguranca-publica',
      officialUrl: 'https://ssp.se.gov.br/',
      documentationUrl: 'https://transparencia.se.gov.br/',
      description: 'Estatísticas de segurança pública e crimes violentos consolidados pela SSP-SE.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SspSeAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SSP-SE' && meta.coverage === 'SE' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura de Sergipe");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SSP-SE' && discovery.url.includes('dados.se.gov.br'), "3. Discovery oficial apontando para repositório de SE");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SSP-SE)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_SE_A', 'COLUNA_DESCONHECIDA_SE_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '2800308',
    municipio: 'Aracaju',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '22',
    latrocinio: '2',
    feminicidio: '1',
    lesao_morte: '1',
    roubo_veiculo: '120',
    furto_veiculo: '95',
    roubo_transeunte: '540',
    roubo_comercio: '90',
    roubo_residencia: '38',
    roubo_coletivo: '45',
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
  assert(robInd?.data.value === 713, "9. Indicador de Roubos (CVP): Agregação de Transeunte (540) + Comércio (90) + Residência (38) + Coletivo (45) = 713");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 120, "10. Indicador de Roubo de Veículos normalizado corretamente (120)");

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
    cod_ibge: '2800308',
    municipio: 'Aracaju',
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
  assert(adapter.mapCrimeToCanonical('Roubo em Via Pública') === 'robbery', "19. Taxonomia: Roubo em Via Pública -> robbery");
  assert(adapter.mapCrimeToCanonical('Tentativa de Homicídio') === 'bodily_harm', "20. Taxonomia: Tentativa de Homicídio -> bodily_harm");
  assert(adapter.mapCrimeToCanonical('Estupro de Vulnerável') === 'sexual_crime', "21. Taxonomia: Estupro de Vulnerável -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Roubo de Carga') === 'cargo_theft', "22. Taxonomia: Roubo de Carga -> cargo_theft");

  // 6. Normalização Geográfica para Municípios Sergipanos
  const ajuNorm = GeoNormalizationService.canonicalizeMunicipalityName('Aracaju');
  assert(ajuNorm === 'aracaju', "23. Geo Normalization: Aracaju");

  const socNorm = GeoNormalizationService.canonicalizeMunicipalityName('Nossa Senhora do Socorro');
  assert(socNorm === 'nossa senhora do socorro', "24. Geo Normalization: Nossa Senhora do Socorro");

  const lagNorm = GeoNormalizationService.canonicalizeMunicipalityName('Lagarto');
  assert(lagNorm === 'lagarto', "25. Geo Normalization: Lagarto");

  const itaNorm = GeoNormalizationService.canonicalizeMunicipalityName('Itabaiana');
  assert(itaNorm === 'itabaiana', "26. Geo Normalization: Itabaiana");

  const scNorm = GeoNormalizationService.canonicalizeMunicipalityName('São Cristóvão');
  assert(scNorm === 'sao cristovao', "27. Geo Normalization: São Cristóvão");

  const ajuAlias = GeoNormalizationService.canonicalizeMunicipalityName('AJU');
  assert(ajuAlias === 'aracaju', "28. Geo Normalization: Alias 'AJU' -> 'aracaju'");

  const socAlias = GeoNormalizationService.canonicalizeMunicipalityName('N. S. do Socorro');
  assert(socAlias === 'nossa senhora do socorro', "29. Geo Normalization: Alias 'N. S. do Socorro' -> 'nossa senhora do socorro'");

  const tobiasAlias = GeoNormalizationService.canonicalizeMunicipalityName('T. Barreto');
  assert(tobiasAlias === 'tobias barreto', "30. Geo Normalization: Alias 'T. Barreto' -> 'tobias barreto'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/ssp-se/ssp_se_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "31. Fixture CSV Wide de municípios sergipanos existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('ssp-se', `audit_${Date.now()}`, 'ssp_se_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "32. Armazenamento RAW da fonte SSP-SE com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SSP-SE',
    datasetId: 'indicadores_municipais_se',
    rawFilePath: storedWide.path,
    originalFilename: 'ssp_se_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true,
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });
  assert(!!jobResult && !!jobResult.jobId, "33. Criação e agendamento de Job de Ingestão para SSP-SE");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "34. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('ssp-se-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "35. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 16, `36. 16 municípios de SE processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 128, `37. 128 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/ssp-se/ssp_se_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('ssp-se', `audit_vert_${Date.now()}`, 'ssp_se_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SSP-SE',
    datasetId: 'indicadores_municipais_se',
    rawFilePath: storedVert.path,
    originalFilename: 'ssp_se_vertical_real.csv',
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
  assert(vertRunResult.success, "38. Processamento do Job SSP-SE (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "39. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/ssp-se/ssp_se_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('ssp-se', `audit_corrupt_${Date.now()}`, 'ssp_se_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SSP-SE',
    datasetId: 'indicadores_municipais_se',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'ssp_se_corrupted_schema.csv',
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
    .where(eq(securityIndicators.sourceId, 'SSP-SE'));

  assert(dbIndicators.length === 136, `42. Verificação DB: Total de 136 registros consolidados (${dbIndicators.length} encontrados)`);

  const ajuHomicide = dbIndicators.find(i => i.municipalityCode === '2800308' && i.category === 'homicide' && i.period === '2024-01');
  assert(ajuHomicide?.value === 26, "43. Verificação DB: 26 vítimas de homicídio registradas em Aracaju no período 2024-01");

  const ajuRobbery = dbIndicators.find(i => i.municipalityCode === '2800308' && i.category === 'robbery' && i.period === '2024-01');
  assert(ajuRobbery?.value === 713, "44. Verificação DB: 713 roubos em Aracaju (540 transeunte + 90 com + 38 res + 45 coletivo)");

  const socRobbery = dbIndicators.find(i => i.municipalityCode === '2804805' && i.category === 'robbery' && i.period === '2024-01');
  assert(socRobbery?.value === 270, "45. Verificação DB: 270 roubos em Nossa Senhora do Socorro");

  const itaVeh = dbIndicators.find(i => i.municipalityCode === '2802908' && i.category === 'vehicle_robbery' && i.period === '2024-01');
  assert(itaVeh?.value === 26, "46. Verificação DB: 26 roubos de veículos em Itabaiana");

  const scDrug = dbIndicators.find(i => i.municipalityCode === '2806701' && i.category === 'drug_related' && i.period === '2024-01');
  assert(scDrug?.value === 28, "47. Verificação DB: 28 ocorrências de drogas em São Cristóvão");

  const estTheft = dbIndicators.find(i => i.municipalityCode === '2802106' && i.category === 'theft' && i.period === '2024-01');
  assert(estTheft?.value === 90, "48. Verificação DB: 90 furtos em Estância");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SSP-SE',
    datasetId: 'indicadores_municipais_se',
    rawFilePath: storedWide.path,
    originalFilename: 'ssp_se_municipios_wide_real.csv',
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
    .where(eq(securityIndicators.sourceId, 'SSP-SE'));

  assert(dbIndicatorsAfterDup.length === 136, "50. Idempotência: Contagem total inalterada no banco de dados (136 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-se'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "51. Status da fonte SSP-SE atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SSP-SE: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSspSeAudit().catch(err => {
  console.error("Erro fatal na auditoria SSP-SE:", err);
  process.exit(1);
});
