import { SespEsAdapter } from '../src/ingestion/adapters/sesp-es/SespEsAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators, geographicMunicipalities } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSespEsAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SESP-ES (ESPÍRITO SANTO)          ");
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

  // 0. Assegurar Fonte SESP-ES no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SESP-ES'));

  const esSource = await db.select().from(dataSources).where(sql`lower(id) = 'sesp-es'`);
  if (esSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SESP-ES',
      name: 'Secretaria de Estado da Segurança Pública e Defesa Social do Espírito Santo',
      provider: 'SESP-ES',
      coverage: 'ES',
      state: 'ES',
      sourceType: 'csv',
      url: 'https://dados.es.gov.br/',
      officialUrl: 'https://sesp.es.gov.br/',
      documentationUrl: 'https://ijsn.es.gov.br/',
      description: 'Estatísticas criminais e dados consolidados pelo Observatório da Segurança Pública do ES e IJSN.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SespEsAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SESP-ES' && meta.coverage === 'ES' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do Espírito Santo");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SESP-ES' && discovery.url.includes('dados.es.gov.br'), "3. Discovery oficial apontando para repositório do Espírito Santo");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_pessoa', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SESP-ES)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_ES_A', 'COLUNA_DESCONHECIDA_ES_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '3205309',
    municipio: 'Vitória',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '6',
    latrocinio: '1',
    feminicidio: '0',
    lesao_morte: '0',
    roubo_veiculo: '32',
    furto_veiculo: '28',
    roubo_pessoa: '195',
    roubo_comercio: '24',
    roubo_residencia: '8',
    roubo_coletivo: '12',
    furto: '380',
    estupro: '8',
    trafico_drogas: '65',
    apreensao_armas: '22'
  });

  assert(Array.isArray(parsedWide) && parsedWide.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = parsedWide?.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 7 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios: Soma correta (6 dolosos + 1 latrocínio = 7)");

  const robInd = parsedWide?.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 239, "9. Indicador de Roubos (CVP): Agregação de Pessoa (195) + Comércio (24) + Residência (8) + Transcol/Coletivo (12)");

  const vehRobInd = parsedWide?.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 32, "10. Indicador de Roubo de Veículos normalizado corretamente");

  const vehTheftInd = parsedWide?.find(r => r.data.category === 'vehicle_theft');
  assert(vehTheftInd?.data.value === 28, "11. Indicador de Furto de Veículos normalizado corretamente");

  const drugInd = parsedWide?.find(r => r.data.category === 'drug_related');
  assert(drugInd?.data.value === 65, "12. Indicador de Tráfico de Entorpecentes normalizado corretamente");

  const armsInd = parsedWide?.find(r => r.data.category === 'other');
  assert(armsInd?.data.value === 22 && armsInd?.data.unit === 'armas', "13. Indicador de Apreensão de Armas de Fogo normalizado");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    cod_ibge: '3205200',
    municipio: 'Vila Velha',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Roubo em Transporte Coletivo',
    total: '18'
  });
  assert(Array.isArray(parsedVertical) && parsedVertical.length === 1, "14. Parsing Vertical: Geração de indicador único");
  assert(parsedVertical?.[0].data.category === 'robbery' && parsedVertical?.[0].data.period === '2024-02', "15. Mapeamento correto de Roubo em Transporte Coletivo / Transcol e mês por extenso");

  // 5. Mapeamento Canônico de Taxonomia Criminal
  assert(adapter.mapCrimeToCanonical('Mortes Violentas por Letalidade Intencional') === 'homicide', "16. Taxonomia: MVLI -> homicide");
  assert(adapter.mapCrimeToCanonical('Feminicídio') === 'homicide', "17. Taxonomia: Feminicídio -> homicide");
  assert(adapter.mapCrimeToCanonical('Roubo Transcol') === 'robbery', "18. Taxonomia: Roubo Transcol -> robbery");
  assert(adapter.mapCrimeToCanonical('Tentativa de Homicídio') === 'bodily_harm', "19. Taxonomia: Tentativa de Homicídio -> bodily_harm");
  assert(adapter.mapCrimeToCanonical('Estupro de Vulnerável') === 'sexual_crime', "20. Taxonomia: Estupro de Vulnerável -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Roubo de Carga') === 'cargo_theft', "21. Taxonomia: Roubo de Carga -> cargo_theft");

  // 6. Normalização Geográfica para Municípios Capixabas
  const vitoriaNorm = GeoNormalizationService.canonicalizeMunicipalityName('Vitória');
  assert(vitoriaNorm === 'vitoria', "22. Geo Normalization: Vitória");

  const vvNorm = GeoNormalizationService.canonicalizeMunicipalityName('Vila Velha');
  assert(vvNorm === 'vila velha', "23. Geo Normalization: Vila Velha");

  const serraNorm = GeoNormalizationService.canonicalizeMunicipalityName('Serra');
  assert(serraNorm === 'serra', "24. Geo Normalization: Serra");

  const cachoeiroAlias = GeoNormalizationService.canonicalizeMunicipalityName('Cachoeiro');
  assert(cachoeiroAlias === 'cachoeiro de itapemirim', "25. Geo Normalization: Alias 'Cachoeiro' -> 'Cachoeiro de Itapemirim'");

  const vixAlias = GeoNormalizationService.canonicalizeMunicipalityName('vix');
  assert(vixAlias === 'vitoria', "26. Geo Normalization: Alias 'vix' -> 'vitoria'");

  const vvAlias = GeoNormalizationService.canonicalizeMunicipalityName('vv');
  assert(vvAlias === 'vila velha', "27. Geo Normalization: Alias 'vv' -> 'vila velha'");

  const sMateusAlias = GeoNormalizationService.canonicalizeMunicipalityName('S. Mateus');
  assert(sMateusAlias === 'sao mateus', "28. Geo Normalization: Alias 'S. Mateus' -> 'sao mateus'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/sesp-es/sesp_es_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "29. Fixture CSV Wide de municípios capixabas existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('sesp-es', `audit_${Date.now()}`, 'sesp_es_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "30. Armazenamento RAW da fonte SESP-ES com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SESP-ES',
    datasetId: 'indicadores_municipais_es',
    rawFilePath: storedWide.path,
    originalFilename: 'sesp_es_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "31. Criação e agendamento de Job de Ingestão para SESP-ES");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "32. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('sesp-es-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "33. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 14, `34. 14 municípios do ES processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 112, `35. 112 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/sesp-es/sesp_es_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('sesp-es', `audit_vert_${Date.now()}`, 'sesp_es_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SESP-ES',
    datasetId: 'indicadores_municipais_es',
    rawFilePath: storedVert.path,
    originalFilename: 'sesp_es_vertical_real.csv',
    checksum: storedVert.metadata.checksum,
    fileSize: storedVert.metadata.size,
    force: true
  });

  const [dbVertJob] = await db.select().from(dataImports).where(eq(dataImports.id, vertJobResult.jobId));
  const vertRunResult = await worker.processJobDirectly(dbVertJob);
  assert(vertRunResult.success, "36. Processamento do Job SESP-ES (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "37. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/sesp-es/sesp_es_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('sesp-es', `audit_corrupt_${Date.now()}`, 'sesp_es_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SESP-ES',
    datasetId: 'indicadores_municipais_es',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'sesp_es_corrupted_schema.csv',
    checksum: storedCorrupt.metadata.checksum,
    fileSize: storedCorrupt.metadata.size,
    force: true
  });

  const [dbCorruptJob] = await db.select().from(dataImports).where(eq(dataImports.id, corruptJobResult.jobId));
  const corruptRunResult = await worker.processJobDirectly(dbCorruptJob);
  assert(!corruptRunResult.success, "38. Quality Gate: Rejeição automática de dataset com schema corrompido");
  assert(corruptRunResult.error?.includes('Quality Gate'), "39. Mensagem de erro explícita de violação do Quality Gate");

  // 10. Verificação no Banco de Dados Real
  const dbIndicators = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SESP-ES'));

  assert(dbIndicators.length === 120, `40. Verificação DB: Total de 120 registros consolidados (${dbIndicators.length} encontrados)`);

  const vitoriaHomicide = dbIndicators.find(i => i.municipalityCode === '3205309' && i.category === 'homicide' && i.period === '2024-01');
  assert(vitoriaHomicide?.value === 7, "41. Verificação DB: 7 vítimas de homicídio registradas em Vitória no período 2024-01");

  const serraRobbery = dbIndicators.find(i => i.municipalityCode === '3205002' && i.category === 'robbery' && i.period === '2024-01');
  assert(serraRobbery?.value === 357, "42. Verificação DB: 357 roubos (285 pessoa + 35 com + 15 res + 22 coletivo) na Serra");

  const vilaVelhaDrug = dbIndicators.find(i => i.municipalityCode === '3205200' && i.category === 'drug_related' && i.period === '2024-01');
  assert(vilaVelhaDrug?.value === 85, "43. Verificação DB: 85 ocorrências de drogas em Vila Velha");

  const cariacicaVeh = dbIndicators.find(i => i.municipalityCode === '3201308' && i.category === 'vehicle_robbery' && i.period === '2024-01');
  assert(cariacicaVeh?.value === 60, "44. Verificação DB: 60 roubos de veículos em Cariacica");

  const cachoeiroTheft = dbIndicators.find(i => i.municipalityCode === '3201209' && i.category === 'theft' && i.period === '2024-01');
  assert(cachoeiroTheft?.value === 160, "45. Verificação DB: 160 furtos em Cachoeiro de Itapemirim");

  const linharesArms = dbIndicators.find(i => i.municipalityCode === '3203205' && i.category === 'other' && i.period === '2024-01');
  assert(linharesArms?.value === 19, "46. Verificação DB: 19 armas apreendidas em Linhares");

  const colatinaRape = dbIndicators.find(i => i.municipalityCode === '3201506' && i.category === 'sexual_crime' && i.period === '2024-01');
  assert(colatinaRape?.value === 4, "47. Verificação DB: 4 estupros registrados em Colatina");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SESP-ES',
    datasetId: 'indicadores_municipais_es',
    rawFilePath: storedWide.path,
    originalFilename: 'sesp_es_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true
  });

  const [dbDupJob] = await db.select().from(dataImports).where(eq(dataImports.id, dupJobResult.jobId));
  const dupRunResult = await worker.processJobDirectly(dbDupJob);
  assert(dupRunResult.success, "48. Re-execução do Job com mesmo dataset concluída com sucesso");

  const dbIndicatorsAfterDup = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SESP-ES'));

  assert(dbIndicatorsAfterDup.length === 120, "49. Idempotência: Contagem total inalterada no banco de dados (120 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'sesp-es'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "50. Status da fonte SESP-ES atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SESP-ES: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSespEsAudit().catch(err => {
  console.error("Erro fatal na auditoria SESP-ES:", err);
  process.exit(1);
});
