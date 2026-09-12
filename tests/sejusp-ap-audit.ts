import { SejuspApAdapter } from '../src/ingestion/adapters/sejusp-ap/SejuspApAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSejuspApAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SEJUSP-AP (AMAPÁ)                 ");
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

  // 0. Assegurar Fonte SEJUSP-AP no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SEJUSP-AP'));

  const apSource = await db.select().from(dataSources).where(sql`lower(id) = 'sejusp-ap'`);
  if (apSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SEJUSP-AP',
      name: 'Secretaria de Estado da Justiça e Segurança Pública do Amapá',
      provider: 'SEJUSP-AP / Estatística',
      coverage: 'AP',
      state: 'AP',
      sourceType: 'csv',
      url: 'https://www.seguranca.ap.gov.br/dados',
      officialUrl: 'https://www.seguranca.ap.gov.br/',
      documentationUrl: 'https://ap.gov.br/',
      description: 'Estatísticas de segurança pública e crimes violentos consolidados pela SEJUSP-AP.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SejuspApAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SEJUSP-AP' && meta.coverage === 'AP' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do Amapá");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SEJUSP-AP' && discovery.url.includes('seguranca.ap.gov.br'), "3. Discovery oficial apontando para repositório do Amapá");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SEJUSP-AP)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_AP_A', 'COLUNA_DESCONHECIDA_AP_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '1600303',
    municipio: 'Macapá',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '25',
    latrocinio: '2',
    feminicidio: '2',
    lesao_morte: '1',
    roubo_veiculo: '170',
    furto_veiculo: '130',
    roubo_transeunte: '700',
    roubo_comercio: '100',
    roubo_residencia: '45',
    roubo_coletivo: '50',
    furto: '880',
    estupro: '32',
    trafico_drogas: '220',
    apreensao_armas: '90'
  });

  const wideList = Array.isArray(parsedWide) ? parsedWide : [];
  assert(Array.isArray(parsedWide) && wideList.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = wideList.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 30 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios (CVLI): Soma correta (25 dolosos + 2 latrocínio + 2 feminicídio + 1 lesão morte = 30)");

  const robInd = wideList.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 895, "9. Indicador de Roubos (CVP): Agregação de Transeunte (700) + Comércio (100) + Residência (45) + Coletivo (50) = 895");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 170, "10. Indicador de Roubo de Veículos normalizado corretamente (170)");

  const vehTheftInd = wideList.find(r => r.data.category === 'vehicle_theft');
  assert(vehTheftInd?.data.value === 130, "11. Indicador de Furto de Veículos normalizado corretamente (130)");

  const theftInd = wideList.find(r => r.data.category === 'theft');
  assert(theftInd?.data.value === 880, "12. Indicador de Furtos Gerais normalizado corretamente (880)");

  const drugInd = wideList.find(r => r.data.category === 'drug_related');
  assert(drugInd?.data.value === 220, "13. Indicador de Tráfico de Entorpecentes normalizado corretamente (220)");

  const armsInd = wideList.find(r => r.data.category === 'other');
  assert(armsInd?.data.value === 90 && armsInd?.data.unit === 'armas', "14. Indicador de Apreensão de Armas de Fogo normalizado (90 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    cod_ibge: '1600303',
    municipio: 'Macapá',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Roubo em Ônibus',
    total: '48'
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

  // 6. Normalização Geográfica para Municípios Amapaenses
  const mcpNorm = GeoNormalizationService.canonicalizeMunicipalityName('Macapá');
  assert(mcpNorm === 'macapa', "23. Geo Normalization: Macapá");

  const stnNorm = GeoNormalizationService.canonicalizeMunicipalityName('Santana');
  assert(stnNorm === 'santana', "24. Geo Normalization: Santana");

  const ljNorm = GeoNormalizationService.canonicalizeMunicipalityName('Laranjal do Jari');
  assert(ljNorm === 'laranjal do jari', "25. Geo Normalization: Laranjal do Jari");

  const opqNorm = GeoNormalizationService.canonicalizeMunicipalityName('Oiapoque');
  assert(opqNorm === 'oiapoque', "26. Geo Normalization: Oiapoque");

  const pgNorm = GeoNormalizationService.canonicalizeMunicipalityName('Porto Grande');
  assert(pgNorm === 'porto grande', "27. Geo Normalization: Porto Grande");

  const mcpAlias = GeoNormalizationService.canonicalizeMunicipalityName('MCP');
  assert(mcpAlias === 'macapa', "28. Geo Normalization: Alias 'MCP' -> 'macapa'");

  const stnAlias = GeoNormalizationService.canonicalizeMunicipalityName('STN');
  assert(stnAlias === 'santana', "29. Geo Normalization: Alias 'STN' -> 'santana'");

  const opqAlias = GeoNormalizationService.canonicalizeMunicipalityName('OPQ');
  assert(opqAlias === 'oiapoque', "30. Geo Normalization: Alias 'OPQ' -> 'oiapoque'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/sejusp-ap/sejusp_ap_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "31. Fixture CSV Wide de municípios amapaenses existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('sejusp-ap', `audit_${Date.now()}`, 'sejusp_ap_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "32. Armazenamento RAW da fonte SEJUSP-AP com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SEJUSP-AP',
    datasetId: 'indicadores_municipais_ap',
    rawFilePath: storedWide.path,
    originalFilename: 'sejusp_ap_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "33. Criação e agendamento de Job de Ingestão para SEJUSP-AP");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "34. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('sejusp-ap-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "35. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 16, `36. 16 municípios do AP processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 128, `37. 128 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/sejusp-ap/sejusp_ap_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('sejusp-ap', `audit_vert_${Date.now()}`, 'sejusp_ap_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SEJUSP-AP',
    datasetId: 'indicadores_municipais_ap',
    rawFilePath: storedVert.path,
    originalFilename: 'sejusp_ap_vertical_real.csv',
    checksum: storedVert.metadata.checksum,
    fileSize: storedVert.metadata.size,
    force: true
  });

  const [dbVertJob] = await db.select().from(dataImports).where(eq(dataImports.id, vertJobResult.jobId));
  const vertRunResult = await worker.processJobDirectly(dbVertJob);
  assert(vertRunResult.success, "38. Processamento do Job SEJUSP-AP (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "39. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/sejusp-ap/sejusp_ap_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('sejusp-ap', `audit_corrupt_${Date.now()}`, 'sejusp_ap_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SEJUSP-AP',
    datasetId: 'indicadores_municipais_ap',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'sejusp_ap_corrupted_schema.csv',
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
    .where(eq(securityIndicators.sourceId, 'SEJUSP-AP'));

  assert(dbIndicators.length === 136, `42. Verificação DB: Total de 136 registros consolidados (${dbIndicators.length} encontrados)`);

  const mcpHomicide = dbIndicators.find(i => i.municipalityCode === '1600303' && i.category === 'homicide' && i.period === '2024-01');
  assert(mcpHomicide?.value === 30, "43. Verificação DB: 30 vítimas de homicídio registradas em Macapá no período 2024-01");

  const mcpRobbery = dbIndicators.find(i => i.municipalityCode === '1600303' && i.category === 'robbery' && i.period === '2024-01');
  assert(mcpRobbery?.value === 895, "44. Verificação DB: 895 roubos em Macapá (700 transeunte + 100 com + 45 res + 50 coletivo)");

  const stnRobbery = dbIndicators.find(i => i.municipalityCode === '1600600' && i.category === 'robbery' && i.period === '2024-01');
  assert(stnRobbery?.value === 354, "45. Verificação DB: 354 roubos em Santana");

  const opqDrugs = dbIndicators.find(i => i.municipalityCode === '1600501' && i.category === 'drug_related' && i.period === '2024-01');
  assert(opqDrugs?.value === 42, "46. Verificação DB: 42 ocorrências de drogas em Oiapoque");

  const ljVehTheft = dbIndicators.find(i => i.municipalityCode === '1600279' && i.category === 'vehicle_theft' && i.period === '2024-01');
  assert(ljVehTheft?.value === 28, "47. Verificação DB: 28 furtos de veículos em Laranjal do Jari");

  const pgArms = dbIndicators.find(i => i.municipalityCode === '1600535' && i.category === 'other' && i.period === '2024-01');
  assert(pgArms?.value === 8, "48. Verificação DB: 8 armas apreendidas em Porto Grande");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SEJUSP-AP',
    datasetId: 'indicadores_municipais_ap',
    rawFilePath: storedWide.path,
    originalFilename: 'sejusp_ap_municipios_wide_real.csv',
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
    .where(eq(securityIndicators.sourceId, 'SEJUSP-AP'));

  assert(dbIndicatorsAfterDup.length === 136, "50. Idempotência: Contagem total inalterada no banco de dados (136 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'sejusp-ap'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "51. Status da fonte SEJUSP-AP atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SEJUSP-AP: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSejuspApAudit().catch(err => {
  console.error("Erro fatal na auditoria SEJUSP-AP:", err);
  process.exit(1);
});
