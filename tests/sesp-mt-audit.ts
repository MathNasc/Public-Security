import { SespMtAdapter } from '../src/ingestion/adapters/sesp-mt/SespMtAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSespMtAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SESP-MT (MATO GROSSO)             ");
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

  // 0. Assegurar Fonte SESP-MT no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SESP-MT'));

  const mtSource = await db.select().from(dataSources).where(sql`lower(id) = 'sesp-mt'`);
  if (mtSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SESP-MT',
      name: 'Secretaria de Estado de Segurança Pública de Mato Grosso',
      provider: 'SESP-MT / Observatório',
      coverage: 'MT',
      state: 'MT',
      sourceType: 'csv',
      url: 'https://www.seguranca.mt.gov.br/dados',
      officialUrl: 'https://www.seguranca.mt.gov.br/',
      documentationUrl: 'https://transparencia.mt.gov.br/',
      description: 'Estatísticas de segurança pública e crimes violentos consolidados pela SESP-MT.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SespMtAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SESP-MT' && meta.coverage === 'MT' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura de Mato Grosso");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SESP-MT' && discovery.url.includes('seguranca.mt.gov.br'), "3. Discovery oficial apontando para repositório do MT");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SESP-MT)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_MT_A', 'COLUNA_DESCONHECIDA_MT_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '5103403',
    municipio: 'Cuiabá',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '28',
    latrocinio: '2',
    feminicidio: '1',
    lesao_morte: '1',
    roubo_veiculo: '190',
    furto_veiculo: '140',
    roubo_transeunte: '780',
    roubo_comercio: '120',
    roubo_residencia: '50',
    roubo_coletivo: '60',
    furto: '980',
    estupro: '35',
    trafico_drogas: '250',
    apreensao_armas: '95'
  });

  const wideList = Array.isArray(parsedWide) ? parsedWide : [];
  assert(Array.isArray(parsedWide) && wideList.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = wideList.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 32 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios (CVLI): Soma correta (28 dolosos + 2 latrocínio + 1 feminicídio + 1 lesão morte = 32)");

  const robInd = wideList.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 1010, "9. Indicador de Roubos (CVP): Agregação de Transeunte (780) + Comércio (120) + Residência (50) + Coletivo (60) = 1010");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 190, "10. Indicador de Roubo de Veículos normalizado corretamente (190)");

  const vehTheftInd = wideList.find(r => r.data.category === 'vehicle_theft');
  assert(vehTheftInd?.data.value === 140, "11. Indicador de Furto de Veículos normalizado corretamente (140)");

  const theftInd = wideList.find(r => r.data.category === 'theft');
  assert(theftInd?.data.value === 980, "12. Indicador de Furtos Gerais normalizado corretamente (980)");

  const drugInd = wideList.find(r => r.data.category === 'drug_related');
  assert(drugInd?.data.value === 250, "13. Indicador de Tráfico de Entorpecentes normalizado corretamente (250)");

  const armsInd = wideList.find(r => r.data.category === 'other');
  assert(armsInd?.data.value === 95 && armsInd?.data.unit === 'armas', "14. Indicador de Apreensão de Armas de Fogo normalizado (95 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    cod_ibge: '5103403',
    municipio: 'Cuiabá',
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

  // 6. Normalização Geográfica para Municípios Matogrossenses
  const cbaNorm = GeoNormalizationService.canonicalizeMunicipalityName('Cuiabá');
  assert(cbaNorm === 'cuiaba', "23. Geo Normalization: Cuiabá");

  const vgNorm = GeoNormalizationService.canonicalizeMunicipalityName('Várzea Grande');
  assert(vgNorm === 'varzea grande', "24. Geo Normalization: Várzea Grande");

  const rooNorm = GeoNormalizationService.canonicalizeMunicipalityName('Rondonópolis');
  assert(rooNorm === 'rondonopolis', "25. Geo Normalization: Rondonópolis");

  const sinNorm = GeoNormalizationService.canonicalizeMunicipalityName('Sinop');
  assert(sinNorm === 'sinop', "26. Geo Normalization: Sinop");

  const tdaNorm = GeoNormalizationService.canonicalizeMunicipalityName('Tangará da Serra');
  assert(tdaNorm === 'tangara da serra', "27. Geo Normalization: Tangará da Serra");

  const cbaAlias = GeoNormalizationService.canonicalizeMunicipalityName('CBA');
  assert(cbaAlias === 'cuiaba', "28. Geo Normalization: Alias 'CBA' -> 'cuiaba'");

  const vgAlias = GeoNormalizationService.canonicalizeMunicipalityName('VG');
  assert(vgAlias === 'varzea grande', "29. Geo Normalization: Alias 'VG' -> 'varzea grande'");

  const rooAlias = GeoNormalizationService.canonicalizeMunicipalityName('ROO');
  assert(rooAlias === 'rondonopolis', "30. Geo Normalization: Alias 'ROO' -> 'rondonopolis'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/sesp-mt/sesp_mt_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "31. Fixture CSV Wide de municípios matogrossenses existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('sesp-mt', `audit_${Date.now()}`, 'sesp_mt_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "32. Armazenamento RAW da fonte SESP-MT com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SESP-MT',
    datasetId: 'indicadores_municipais_mt',
    rawFilePath: storedWide.path,
    originalFilename: 'sesp_mt_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "33. Criação e agendamento de Job de Ingestão para SESP-MT");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "34. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('sesp-mt-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "35. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 17, `36. 17 municípios de MT processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 136, `37. 136 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/sesp-mt/sesp_mt_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('sesp-mt', `audit_vert_${Date.now()}`, 'sesp_mt_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SESP-MT',
    datasetId: 'indicadores_municipais_mt',
    rawFilePath: storedVert.path,
    originalFilename: 'sesp_mt_vertical_real.csv',
    checksum: storedVert.metadata.checksum,
    fileSize: storedVert.metadata.size,
    force: true
  });

  const [dbVertJob] = await db.select().from(dataImports).where(eq(dataImports.id, vertJobResult.jobId));
  const vertRunResult = await worker.processJobDirectly(dbVertJob);
  assert(vertRunResult.success, "38. Processamento do Job SESP-MT (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "39. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/sesp-mt/sesp_mt_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('sesp-mt', `audit_corrupt_${Date.now()}`, 'sesp_mt_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SESP-MT',
    datasetId: 'indicadores_municipais_mt',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'sesp_mt_corrupted_schema.csv',
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
    .where(eq(securityIndicators.sourceId, 'SESP-MT'));

  assert(dbIndicators.length === 144, `42. Verificação DB: Total de 144 registros consolidados (${dbIndicators.length} encontrados)`);

  const cbaHomicide = dbIndicators.find(i => i.municipalityCode === '5103403' && i.category === 'homicide' && i.period === '2024-01');
  assert(cbaHomicide?.value === 32, "43. Verificação DB: 32 vítimas de homicídio registradas em Cuiabá no período 2024-01");

  const cbaRobbery = dbIndicators.find(i => i.municipalityCode === '5103403' && i.category === 'robbery' && i.period === '2024-01');
  assert(cbaRobbery?.value === 1010, "44. Verificação DB: 1010 roubos em Cuiabá (780 transeunte + 120 com + 50 res + 60 coletivo)");

  const vgRobbery = dbIndicators.find(i => i.municipalityCode === '5108402' && i.category === 'robbery' && i.period === '2024-01');
  assert(vgRobbery?.value === 543, "45. Verificação DB: 543 roubos em Várzea Grande");

  const rooVeh = dbIndicators.find(i => i.municipalityCode === '5107602' && i.category === 'vehicle_robbery' && i.period === '2024-01');
  assert(rooVeh?.value === 65, "46. Verificação DB: 65 roubos de veículos em Rondonópolis");

  const sinDrug = dbIndicators.find(i => i.municipalityCode === '5107909' && i.category === 'drug_related' && i.period === '2024-01');
  assert(sinDrug?.value === 72, "47. Verificação DB: 72 ocorrências de drogas em Sinop");

  const sorTheft = dbIndicators.find(i => i.municipalityCode === '5107925' && i.category === 'theft' && i.period === '2024-01');
  assert(sorTheft?.value === 180, "48. Verificação DB: 180 furtos em Sorriso");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SESP-MT',
    datasetId: 'indicadores_municipais_mt',
    rawFilePath: storedWide.path,
    originalFilename: 'sesp_mt_municipios_wide_real.csv',
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
    .where(eq(securityIndicators.sourceId, 'SESP-MT'));

  assert(dbIndicatorsAfterDup.length === 144, "50. Idempotência: Contagem total inalterada no banco de dados (144 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'sesp-mt'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "51. Status da fonte SESP-MT atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SESP-MT: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSespMtAudit().catch(err => {
  console.error("Erro fatal na auditoria SESP-MT:", err);
  process.exit(1);
});
