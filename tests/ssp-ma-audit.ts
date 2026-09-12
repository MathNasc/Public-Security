import { SspMaAdapter } from '../src/ingestion/adapters/ssp-ma/SspMaAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSspMaAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SSP-MA (MARANHÃO)                 ");
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

  // 0. Assegurar Fonte SSP-MA no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SSP-MA'));

  const maSource = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-ma'`);
  if (maSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SSP-MA',
      name: 'Secretaria de Estado de Segurança Pública do Maranhão',
      provider: 'SSP-MA / SIOSP',
      coverage: 'MA',
      state: 'MA',
      sourceType: 'csv',
      url: 'https://www.seguranca.ma.gov.br/estatisticas',
      officialUrl: 'https://www.seguranca.ma.gov.br/',
      documentationUrl: 'https://transparencia.ma.gov.br/',
      description: 'Estatísticas criminais consolidadas pela SSP-MA e Centro Integrado de Estatística.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SspMaAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SSP-MA' && meta.coverage === 'MA' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do Maranhão");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SSP-MA' && discovery.url.includes('seguranca.ma.gov.br'), "3. Discovery oficial apontando para repositório do Maranhão");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SSP-MA)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_MA_A', 'COLUNA_DESCONHECIDA_MA_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '2111300',
    municipio: 'São Luís',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '28',
    latrocinio: '3',
    feminicidio: '1',
    lesao_morte: '1',
    roubo_veiculo: '165',
    furto_veiculo: '130',
    roubo_transeunte: '780',
    roubo_comercio: '140',
    roubo_residencia: '45',
    roubo_coletivo: '68',
    furto: '1100',
    estupro: '42',
    trafico_drogas: '240',
    apreensao_armas: '95'
  });

  const wideList = Array.isArray(parsedWide) ? parsedWide : [];
  assert(Array.isArray(parsedWide) && wideList.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = wideList.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 33 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios (CVLI): Soma correta (28 dolosos + 3 latrocínio + 1 feminicídio + 1 lesão morte = 33)");

  const robInd = wideList.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 1033, "9. Indicador de Roubos (CVP): Agregação de Transeunte (780) + Comércio (140) + Residência (45) + Coletivo (68) = 1033");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 165, "10. Indicador de Roubo de Veículos normalizado corretamente (165)");

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
    cod_ibge: '2111300',
    municipio: 'São Luís',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Roubo em Ônibus',
    total: '55'
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

  // 6. Normalização Geográfica para Municípios Maranhenses
  const slzNorm = GeoNormalizationService.canonicalizeMunicipalityName('São Luís');
  assert(slzNorm === 'sao luis', "23. Geo Normalization: São Luís");

  const impNorm = GeoNormalizationService.canonicalizeMunicipalityName('Imperatriz');
  assert(impNorm === 'imperatriz', "24. Geo Normalization: Imperatriz");

  const ribamarNorm = GeoNormalizationService.canonicalizeMunicipalityName('São José de Ribamar');
  assert(ribamarNorm === 'sao jose de ribamar', "25. Geo Normalization: São José de Ribamar");

  const timonNorm = GeoNormalizationService.canonicalizeMunicipalityName('Timon');
  assert(timonNorm === 'timon', "26. Geo Normalization: Timon");

  const caxiasNorm = GeoNormalizationService.canonicalizeMunicipalityName('Caxias');
  assert(caxiasNorm === 'caxias', "27. Geo Normalization: Caxias");

  const slzAlias = GeoNormalizationService.canonicalizeMunicipalityName('SLZ');
  assert(slzAlias === 'sao luis', "28. Geo Normalization: Alias 'SLZ' -> 'sao luis'");

  const sJoseAlias = GeoNormalizationService.canonicalizeMunicipalityName('S. José de Ribamar');
  assert(sJoseAlias === 'sao jose de ribamar', "29. Geo Normalization: Alias 'S. José de Ribamar' -> 'sao jose de ribamar'");

  const staInesAlias = GeoNormalizationService.canonicalizeMunicipalityName('Sta. Inês');
  assert(staInesAlias === 'santa ines', "30. Geo Normalization: Alias 'Sta. Inês' -> 'santa ines'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/ssp-ma/ssp_ma_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "31. Fixture CSV Wide de municípios maranhenses existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('ssp-ma', `audit_${Date.now()}`, 'ssp_ma_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "32. Armazenamento RAW da fonte SSP-MA com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SSP-MA',
    datasetId: 'indicadores_municipais_ma',
    rawFilePath: storedWide.path,
    originalFilename: 'ssp_ma_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true,
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });
  assert(!!jobResult && !!jobResult.jobId, "33. Criação e agendamento de Job de Ingestão para SSP-MA");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "34. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('ssp-ma-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "35. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 16, `36. 16 municípios do MA processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 128, `37. 128 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/ssp-ma/ssp_ma_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('ssp-ma', `audit_vert_${Date.now()}`, 'ssp_ma_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SSP-MA',
    datasetId: 'indicadores_municipais_ma',
    rawFilePath: storedVert.path,
    originalFilename: 'ssp_ma_vertical_real.csv',
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
  assert(vertRunResult.success, "38. Processamento do Job SSP-MA (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "39. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/ssp-ma/ssp_ma_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('ssp-ma', `audit_corrupt_${Date.now()}`, 'ssp_ma_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SSP-MA',
    datasetId: 'indicadores_municipais_ma',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'ssp_ma_corrupted_schema.csv',
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
    .where(eq(securityIndicators.sourceId, 'SSP-MA'));

  assert(dbIndicators.length === 136, `42. Verificação DB: Total de 136 registros consolidados (${dbIndicators.length} encontrados)`);

  const slzHomicide = dbIndicators.find(i => i.municipalityCode === '2111300' && i.category === 'homicide' && i.period === '2024-01');
  assert(slzHomicide?.value === 33, "43. Verificação DB: 33 vítimas de homicídio registradas em São Luís no período 2024-01");

  const slzRobbery = dbIndicators.find(i => i.municipalityCode === '2111300' && i.category === 'robbery' && i.period === '2024-01');
  assert(slzRobbery?.value === 1033, "44. Verificação DB: 1033 roubos em São Luís (780 transeunte + 140 com + 45 res + 68 coletivo)");

  const impRobbery = dbIndicators.find(i => i.municipalityCode === '2105302' && i.category === 'robbery' && i.period === '2024-01');
  assert(impRobbery?.value === 275, "45. Verificação DB: 275 roubos em Imperatriz");

  const caxiasDrug = dbIndicators.find(i => i.municipalityCode === '2103000' && i.category === 'drug_related' && i.period === '2024-01');
  assert(caxiasDrug?.value === 42, "46. Verificação DB: 42 ocorrências de drogas em Caxias");

  const timonVeh = dbIndicators.find(i => i.municipalityCode === '2112209' && i.category === 'vehicle_robbery' && i.period === '2024-01');
  assert(timonVeh?.value === 32, "47. Verificação DB: 32 roubos de veículos em Timon");

  const ribamarTheft = dbIndicators.find(i => i.municipalityCode === '2111201' && i.category === 'theft' && i.period === '2024-01');
  assert(ribamarTheft?.value === 240, "48. Verificação DB: 240 furtos em São José de Ribamar");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SSP-MA',
    datasetId: 'indicadores_municipais_ma',
    rawFilePath: storedWide.path,
    originalFilename: 'ssp_ma_municipios_wide_real.csv',
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
    .where(eq(securityIndicators.sourceId, 'SSP-MA'));

  assert(dbIndicatorsAfterDup.length === 136, "50. Idempotência: Contagem total inalterada no banco de dados (136 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-ma'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "51. Status da fonte SSP-MA atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SSP-MA: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSspMaAudit().catch(err => {
  console.error("Erro fatal na auditoria SSP-MA:", err);
  process.exit(1);
});
