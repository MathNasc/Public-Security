import { SspPiAdapter } from '../src/ingestion/adapters/ssp-pi/SspPiAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSspPiAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SSP-PI (PIAUÍ)                    ");
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

  // 0. Assegurar Fonte SSP-PI no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SSP-PI'));

  const piSource = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-pi'`);
  if (piSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SSP-PI',
      name: 'Secretaria de Segurança Pública do Estado do Piauí',
      provider: 'SSP-PI / GEAC',
      coverage: 'PI',
      state: 'PI',
      sourceType: 'csv',
      url: 'https://www.seguranca.pi.gov.br/dados',
      officialUrl: 'https://www.seguranca.pi.gov.br/',
      documentationUrl: 'https://transparencia.pi.gov.br/',
      description: 'Estatísticas de segurança pública e crimes violentos consolidados pela SSP-PI.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SspPiAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SSP-PI' && meta.coverage === 'PI' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do Piauí");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SSP-PI' && discovery.url.includes('seguranca.pi.gov.br'), "3. Discovery oficial apontando para repositório do PI");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SSP-PI)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_PI_A', 'COLUNA_DESCONHECIDA_PI_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '2211001',
    municipio: 'Teresina',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '35',
    latrocinio: '3',
    feminicidio: '1',
    lesao_morte: '1',
    roubo_veiculo: '240',
    furto_veiculo: '180',
    roubo_transeunte: '920',
    roubo_comercio: '150',
    roubo_residencia: '65',
    roubo_coletivo: '75',
    furto: '1200',
    estupro: '42',
    trafico_drogas: '310',
    apreensao_armas: '120'
  });

  const wideList = Array.isArray(parsedWide) ? parsedWide : [];
  assert(Array.isArray(parsedWide) && wideList.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = wideList.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 40 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios (CVLI): Soma correta (35 dolosos + 3 latrocínio + 1 feminicídio + 1 lesão morte = 40)");

  const robInd = wideList.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 1210, "9. Indicador de Roubos (CVP): Agregação de Transeunte (920) + Comércio (150) + Residência (65) + Coletivo (75) = 1210");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 240, "10. Indicador de Roubo de Veículos normalizado corretamente (240)");

  const vehTheftInd = wideList.find(r => r.data.category === 'vehicle_theft');
  assert(vehTheftInd?.data.value === 180, "11. Indicador de Furto de Veículos normalizado corretamente (180)");

  const theftInd = wideList.find(r => r.data.category === 'theft');
  assert(theftInd?.data.value === 1200, "12. Indicador de Furtos Gerais normalizado corretamente (1200)");

  const drugInd = wideList.find(r => r.data.category === 'drug_related');
  assert(drugInd?.data.value === 310, "13. Indicador de Tráfico de Entorpecentes normalizado corretamente (310)");

  const armsInd = wideList.find(r => r.data.category === 'other');
  assert(armsInd?.data.value === 120 && armsInd?.data.unit === 'armas', "14. Indicador de Apreensão de Armas de Fogo normalizado (120 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    cod_ibge: '2211001',
    municipio: 'Teresina',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Roubo em Ônibus',
    total: '65'
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

  // 6. Normalização Geográfica para Municípios Piauieses
  const theNorm = GeoNormalizationService.canonicalizeMunicipalityName('Teresina');
  assert(theNorm === 'teresina', "23. Geo Normalization: Teresina");

  const phbNorm = GeoNormalizationService.canonicalizeMunicipalityName('Parnaíba');
  assert(phbNorm === 'parnaiba', "24. Geo Normalization: Parnaíba");

  const picNorm = GeoNormalizationService.canonicalizeMunicipalityName('Picos');
  assert(picNorm === 'picos', "25. Geo Normalization: Picos");

  const pirNorm = GeoNormalizationService.canonicalizeMunicipalityName('Piripiri');
  assert(pirNorm === 'piripiri', "26. Geo Normalization: Piripiri");

  const floNorm = GeoNormalizationService.canonicalizeMunicipalityName('Floriano');
  assert(floNorm === 'floriano', "27. Geo Normalization: Floriano");

  const theAlias = GeoNormalizationService.canonicalizeMunicipalityName('THE');
  assert(theAlias === 'teresina', "28. Geo Normalization: Alias 'THE' -> 'teresina'");

  const phbAlias = GeoNormalizationService.canonicalizeMunicipalityName('PHB');
  assert(phbAlias === 'parnaiba', "29. Geo Normalization: Alias 'PHB' -> 'parnaiba'");

  const jfreitasAlias = GeoNormalizationService.canonicalizeMunicipalityName('J. de Freitas');
  assert(jfreitasAlias === 'jose de freitas', "30. Geo Normalization: Alias 'J. de Freitas' -> 'jose de freitas'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/ssp-pi/ssp_pi_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "31. Fixture CSV Wide de municípios piauieses existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('ssp-pi', `audit_${Date.now()}`, 'ssp_pi_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "32. Armazenamento RAW da fonte SSP-PI com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SSP-PI',
    datasetId: 'indicadores_municipais_pi',
    rawFilePath: storedWide.path,
    originalFilename: 'ssp_pi_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "33. Criação e agendamento de Job de Ingestão para SSP-PI");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "34. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('ssp-pi-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "35. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 16, `36. 16 municípios de PI processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 128, `37. 128 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/ssp-pi/ssp_pi_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('ssp-pi', `audit_vert_${Date.now()}`, 'ssp_pi_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SSP-PI',
    datasetId: 'indicadores_municipais_pi',
    rawFilePath: storedVert.path,
    originalFilename: 'ssp_pi_vertical_real.csv',
    checksum: storedVert.metadata.checksum,
    fileSize: storedVert.metadata.size,
    force: true
  });

  const [dbVertJob] = await db.select().from(dataImports).where(eq(dataImports.id, vertJobResult.jobId));
  const vertRunResult = await worker.processJobDirectly(dbVertJob);
  assert(vertRunResult.success, "38. Processamento do Job SSP-PI (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "39. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/ssp-pi/ssp_pi_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('ssp-pi', `audit_corrupt_${Date.now()}`, 'ssp_pi_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SSP-PI',
    datasetId: 'indicadores_municipais_pi',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'ssp_pi_corrupted_schema.csv',
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
    .where(eq(securityIndicators.sourceId, 'SSP-PI'));

  assert(dbIndicators.length === 136, `42. Verificação DB: Total de 136 registros consolidados (${dbIndicators.length} encontrados)`);

  const theHomicide = dbIndicators.find(i => i.municipalityCode === '2211001' && i.category === 'homicide' && i.period === '2024-01');
  assert(theHomicide?.value === 40, "43. Verificação DB: 40 vítimas de homicídio registradas em Teresina no período 2024-01");

  const theRobbery = dbIndicators.find(i => i.municipalityCode === '2211001' && i.category === 'robbery' && i.period === '2024-01');
  assert(theRobbery?.value === 1210, "44. Verificação DB: 1210 roubos em Teresina (920 transeunte + 150 com + 65 res + 75 coletivo)");

  const phbRobbery = dbIndicators.find(i => i.municipalityCode === '2207702' && i.category === 'robbery' && i.period === '2024-01');
  assert(phbRobbery?.value === 230, "45. Verificação DB: 230 roubos em Parnaíba");

  const picVeh = dbIndicators.find(i => i.municipalityCode === '2208007' && i.category === 'vehicle_robbery' && i.period === '2024-01');
  assert(picVeh?.value === 25, "46. Verificação DB: 25 roubos de veículos em Picos");

  const floDrug = dbIndicators.find(i => i.municipalityCode === '2203909' && i.category === 'drug_related' && i.period === '2024-01');
  assert(floDrug?.value === 24, "47. Verificação DB: 24 ocorrências de drogas em Floriano");

  const cmTheft = dbIndicators.find(i => i.municipalityCode === '2202208' && i.category === 'theft' && i.period === '2024-01');
  assert(cmTheft?.value === 80, "48. Verificação DB: 80 furtos em Campo Maior");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SSP-PI',
    datasetId: 'indicadores_municipais_pi',
    rawFilePath: storedWide.path,
    originalFilename: 'ssp_pi_municipios_wide_real.csv',
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
    .where(eq(securityIndicators.sourceId, 'SSP-PI'));

  assert(dbIndicatorsAfterDup.length === 136, "50. Idempotência: Contagem total inalterada no banco de dados (136 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-pi'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "51. Status da fonte SSP-PI atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SSP-PI: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSspPiAudit().catch(err => {
  console.error("Erro fatal na auditoria SSP-PI:", err);
  process.exit(1);
});
