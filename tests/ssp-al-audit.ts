import { SspAlAdapter } from '../src/ingestion/adapters/ssp-al/SspAlAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSspAlAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SSP-AL (ALAGOAS)                  ");
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

  // 0. Assegurar Fonte SSP-AL no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SSP-AL'));

  const alSource = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-al'`);
  if (alSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SSP-AL',
      name: 'Secretaria de Estado da Segurança Pública de Alagoas',
      provider: 'SSP-AL / CIEG',
      coverage: 'AL',
      state: 'AL',
      sourceType: 'csv',
      url: 'https://dados.al.gov.br/dataset/seguranca-publica',
      officialUrl: 'https://seguranca.al.gov.br/',
      documentationUrl: 'https://transparencia.al.gov.br/',
      description: 'Estatísticas de segurança pública e crimes violentos letais intencionais consolidados pela SSP-AL.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SspAlAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SSP-AL' && meta.coverage === 'AL' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura de Alagoas");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SSP-AL' && discovery.url.includes('dados.al.gov.br'), "3. Discovery oficial apontando para repositório de AL");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SSP-AL)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_AL_A', 'COLUNA_DESCONHECIDA_AL_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '2704302',
    municipio: 'Maceió',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '34',
    latrocinio: '3',
    feminicidio: '2',
    lesao_morte: '1',
    roubo_veiculo: '160',
    furto_veiculo: '130',
    roubo_transeunte: '710',
    roubo_comercio: '120',
    roubo_residencia: '50',
    roubo_coletivo: '60',
    furto: '1100',
    estupro: '38',
    trafico_drogas: '240',
    apreensao_armas: '95'
  });

  const wideList = Array.isArray(parsedWide) ? parsedWide : [];
  assert(Array.isArray(parsedWide) && wideList.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = wideList.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 40 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios (CVLI): Soma correta (34 dolosos + 3 latrocínio + 2 feminicídio + 1 lesão morte = 40)");

  const robInd = wideList.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 940, "9. Indicador de Roubos (CVP): Agregação de Transeunte (710) + Comércio (120) + Residência (50) + Coletivo (60) = 940");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 160, "10. Indicador de Roubo de Veículos normalizado corretamente (160)");

  const vehTheftInd = wideList.find(r => r.data.category === 'vehicle_theft');
  assert(vehTheftInd?.data.value === 130, "11. Indicador de Furto de Veículos normalizado corretamente (130)");

  const theftInd = wideList.find(r => r.data.category === 'theft');
  assert(theftInd?.data.value === 1100, "12. Indicador de Furtos Gerais normalizado corretamente (1100)");

  const drugInd = wideList.find(r => r.data.category === 'drug_related');
  assert(drugInd?.data.value === 240, "13. Indicador de Tráfico de Entorpecentes normalizado corretamente (240)");

  const armsInd = wideList.find(r => r.data.category === 'other');
  assert(armsInd?.data.value === 95 && armsInd?.data.unit === 'armas', "14. Indicador de Apreensão de Armas de Fogo normalizado (95 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    cod_ibge: '2704302',
    municipio: 'Maceió',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Roubo em Ônibus',
    total: '52'
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

  // 6. Normalização Geográfica para Municípios Alagoanos
  const mczNorm = GeoNormalizationService.canonicalizeMunicipalityName('Maceió');
  assert(mczNorm === 'maceio', "23. Geo Normalization: Maceió");

  const araNorm = GeoNormalizationService.canonicalizeMunicipalityName('Arapiraca');
  assert(araNorm === 'arapiraca', "24. Geo Normalization: Arapiraca");

  const rioNorm = GeoNormalizationService.canonicalizeMunicipalityName('Rio Largo');
  assert(rioNorm === 'rio largo', "25. Geo Normalization: Rio Largo");

  const palNorm = GeoNormalizationService.canonicalizeMunicipalityName('Palmeira dos Índios');
  assert(palNorm === 'palmeira dos indios', "26. Geo Normalization: Palmeira dos Índios");

  const teoNorm = GeoNormalizationService.canonicalizeMunicipalityName('Teotônio Vilela');
  assert(teoNorm === 'teotonio vilela', "27. Geo Normalization: Teotônio Vilela");

  const mczAlias = GeoNormalizationService.canonicalizeMunicipalityName('MCZ');
  assert(mczAlias === 'maceio', "28. Geo Normalization: Alias 'MCZ' -> 'maceio'");

  const pIndiosAlias = GeoNormalizationService.canonicalizeMunicipalityName('P. dos Indios');
  assert(pIndiosAlias === 'palmeira dos indios', "29. Geo Normalization: Alias 'P. dos Indios' -> 'palmeira dos indios'");

  const teotonioAlias = GeoNormalizationService.canonicalizeMunicipalityName('Teotonio');
  assert(teotonioAlias === 'teotonio vilela', "30. Geo Normalization: Alias 'Teotonio' -> 'teotonio vilela'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/ssp-al/ssp_al_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "31. Fixture CSV Wide de municípios alagoanos existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('ssp-al', `audit_${Date.now()}`, 'ssp_al_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "32. Armazenamento RAW da fonte SSP-AL com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SSP-AL',
    datasetId: 'indicadores_municipais_al',
    rawFilePath: storedWide.path,
    originalFilename: 'ssp_al_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true,
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });
  assert(!!jobResult && !!jobResult.jobId, "33. Criação e agendamento de Job de Ingestão para SSP-AL");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "34. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('ssp-al-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "35. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 16, `36. 16 municípios de AL processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 128, `37. 128 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/ssp-al/ssp_al_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('ssp-al', `audit_vert_${Date.now()}`, 'ssp_al_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SSP-AL',
    datasetId: 'indicadores_municipais_al',
    rawFilePath: storedVert.path,
    originalFilename: 'ssp_al_vertical_real.csv',
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
  assert(vertRunResult.success, "38. Processamento do Job SSP-AL (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "39. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/ssp-al/ssp_al_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('ssp-al', `audit_corrupt_${Date.now()}`, 'ssp_al_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SSP-AL',
    datasetId: 'indicadores_municipais_al',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'ssp_al_corrupted_schema.csv',
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
    .where(eq(securityIndicators.sourceId, 'SSP-AL'));

  assert(dbIndicators.length === 136, `42. Verificação DB: Total de 136 registros consolidados (${dbIndicators.length} encontrados)`);

  const mczHomicide = dbIndicators.find(i => i.municipalityCode === '2704302' && i.category === 'homicide' && i.period === '2024-01');
  assert(mczHomicide?.value === 40, "43. Verificação DB: 40 vítimas de homicídio registradas em Maceió no período 2024-01");

  const mczRobbery = dbIndicators.find(i => i.municipalityCode === '2704302' && i.category === 'robbery' && i.period === '2024-01');
  assert(mczRobbery?.value === 940, "44. Verificação DB: 940 roubos em Maceió (710 transeunte + 120 com + 50 res + 60 coletivo)");

  const araRobbery = dbIndicators.find(i => i.municipalityCode === '2700300' && i.category === 'robbery' && i.period === '2024-01');
  assert(araRobbery?.value === 335, "45. Verificação DB: 335 roubos em Arapiraca");

  const rioVeh = dbIndicators.find(i => i.municipalityCode === '2707701' && i.category === 'vehicle_robbery' && i.period === '2024-01');
  assert(rioVeh?.value === 32, "46. Verificação DB: 32 roubos de veículos em Rio Largo");

  const smcDrug = dbIndicators.find(i => i.municipalityCode === '2708907' && i.category === 'drug_related' && i.period === '2024-01');
  assert(smcDrug?.value === 26, "47. Verificação DB: 26 ocorrências de drogas em São Miguel dos Campos");

  const mdTheft = dbIndicators.find(i => i.municipalityCode === '2704708' && i.category === 'theft' && i.period === '2024-01');
  assert(mdTheft?.value === 95, "48. Verificação DB: 95 furtos em Marechal Deodoro");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SSP-AL',
    datasetId: 'indicadores_municipais_al',
    rawFilePath: storedWide.path,
    originalFilename: 'ssp_al_municipios_wide_real.csv',
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
    .where(eq(securityIndicators.sourceId, 'SSP-AL'));

  assert(dbIndicatorsAfterDup.length === 136, "50. Idempotência: Contagem total inalterada no banco de dados (136 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-al'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "51. Status da fonte SSP-AL atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SSP-AL: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSspAlAudit().catch(err => {
  console.error("Erro fatal na auditoria SSP-AL:", err);
  process.exit(1);
});
