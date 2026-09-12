import { SespRrAdapter } from '../src/ingestion/adapters/sesp-rr/SespRrAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSespRrAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SESP-RR (RORAIMA)                 ");
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

  // 0. Assegurar Fonte SESP-RR no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SESP-RR'));

  const rrSource = await db.select().from(dataSources).where(sql`lower(id) = 'sesp-rr'`);
  if (rrSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SESP-RR',
      name: 'Secretaria de Estado da Segurança Pública de Roraima',
      provider: 'SESP-RR / Estatística',
      coverage: 'RR',
      state: 'RR',
      sourceType: 'csv',
      url: 'https://www.seguranca.rr.gov.br/dados',
      officialUrl: 'https://www.seguranca.rr.gov.br/',
      documentationUrl: 'https://rr.gov.br/',
      description: 'Estatísticas de segurança pública e crimes violentos consolidados pela SESP-RR.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SespRrAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SESP-RR' && meta.coverage === 'RR' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura de Roraima");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SESP-RR' && discovery.url.includes('seguranca.rr.gov.br'), "3. Discovery oficial apontando para repositório de Roraima");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SESP-RR)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_RR_A', 'COLUNA_DESCONHECIDA_RR_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '1400100',
    municipio: 'Boa Vista',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '20',
    latrocinio: '2',
    feminicidio: '1',
    lesao_morte: '1',
    roubo_veiculo: '150',
    furto_veiculo: '110',
    roubo_transeunte: '650',
    roubo_comercio: '90',
    roubo_residencia: '40',
    roubo_coletivo: '42',
    furto: '800',
    estupro: '28',
    trafico_drogas: '190',
    apreensao_armas: '80'
  });

  const wideList = Array.isArray(parsedWide) ? parsedWide : [];
  assert(Array.isArray(parsedWide) && wideList.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = wideList.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 24 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios (CVLI): Soma correta (20 dolosos + 2 latrocínio + 1 feminicídio + 1 lesão morte = 24)");

  const robInd = wideList.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 822, "9. Indicador de Roubos (CVP): Agregação de Transeunte (650) + Comércio (90) + Residência (40) + Coletivo (42) = 822");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 150, "10. Indicador de Roubo de Veículos normalizado corretamente (150)");

  const vehTheftInd = wideList.find(r => r.data.category === 'vehicle_theft');
  assert(vehTheftInd?.data.value === 110, "11. Indicador de Furto de Veículos normalizado corretamente (110)");

  const theftInd = wideList.find(r => r.data.category === 'theft');
  assert(theftInd?.data.value === 800, "12. Indicador de Furtos Gerais normalizado corretamente (800)");

  const drugInd = wideList.find(r => r.data.category === 'drug_related');
  assert(drugInd?.data.value === 190, "13. Indicador de Tráfico de Entorpecentes normalizado corretamente (190)");

  const armsInd = wideList.find(r => r.data.category === 'other');
  assert(armsInd?.data.value === 80 && armsInd?.data.unit === 'armas', "14. Indicador de Apreensão de Armas de Fogo normalizado (80 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    cod_ibge: '1400100',
    municipio: 'Boa Vista',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Roubo em Ônibus',
    total: '40'
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

  // 6. Normalização Geográfica para Municípios Roraimenses
  const bvaNorm = GeoNormalizationService.canonicalizeMunicipalityName('Boa Vista');
  assert(bvaNorm === 'boa vista', "23. Geo Normalization: Boa Vista");

  const rrpNorm = GeoNormalizationService.canonicalizeMunicipalityName('Rorainópolis');
  assert(rrpNorm === 'rorainopolis', "24. Geo Normalization: Rorainópolis");

  const carNorm = GeoNormalizationService.canonicalizeMunicipalityName('Caracaraí');
  assert(carNorm === 'caracarai', "25. Geo Normalization: Caracaraí");

  const pacNorm = GeoNormalizationService.canonicalizeMunicipalityName('Pacaraima');
  assert(pacNorm === 'pacaraima', "26. Geo Normalization: Pacaraima");

  const cntNorm = GeoNormalizationService.canonicalizeMunicipalityName('Cantá');
  assert(cntNorm === 'canta', "27. Geo Normalization: Cantá");

  const bvaAlias = GeoNormalizationService.canonicalizeMunicipalityName('BVA');
  assert(bvaAlias === 'boa vista', "28. Geo Normalization: Alias 'BVA' -> 'boa vista'");

  const rrpAlias = GeoNormalizationService.canonicalizeMunicipalityName('RRP');
  assert(rrpAlias === 'rorainopolis', "29. Geo Normalization: Alias 'RRP' -> 'rorainopolis'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/sesp-rr/sesp_rr_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "30. Fixture CSV Wide de municípios roraimenses existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('sesp-rr', `audit_${Date.now()}`, 'sesp_rr_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "31. Armazenamento RAW da fonte SESP-RR com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SESP-RR',
    datasetId: 'indicadores_municipais_rr',
    rawFilePath: storedWide.path,
    originalFilename: 'sesp_rr_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "32. Criação e agendamento de Job de Ingestão para SESP-RR");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "33. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('sesp-rr-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "34. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 15, `35. 15 municípios de RR processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 120, `36. 120 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/sesp-rr/sesp_rr_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('sesp-rr', `audit_vert_${Date.now()}`, 'sesp_rr_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SESP-RR',
    datasetId: 'indicadores_municipais_rr',
    rawFilePath: storedVert.path,
    originalFilename: 'sesp_rr_vertical_real.csv',
    checksum: storedVert.metadata.checksum,
    fileSize: storedVert.metadata.size,
    force: true
  });

  const [dbVertJob] = await db.select().from(dataImports).where(eq(dataImports.id, vertJobResult.jobId));
  const vertRunResult = await worker.processJobDirectly(dbVertJob);
  assert(vertRunResult.success, "37. Processamento do Job SESP-RR (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "38. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/sesp-rr/sesp_rr_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('sesp-rr', `audit_corrupt_${Date.now()}`, 'sesp_rr_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SESP-RR',
    datasetId: 'indicadores_municipais_rr',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'sesp_rr_corrupted_schema.csv',
    checksum: storedCorrupt.metadata.checksum,
    fileSize: storedCorrupt.metadata.size,
    force: true
  });

  const [dbCorruptJob] = await db.select().from(dataImports).where(eq(dataImports.id, corruptJobResult.jobId));
  const corruptRunResult = await worker.processJobDirectly(dbCorruptJob);
  assert(!corruptRunResult.success, "39. Quality Gate: Rejeição automática de dataset com schema corrompido");
  assert(corruptRunResult.error?.includes('Quality Gate'), "40. Mensagem de erro explícita de violação do Quality Gate");

  // 10. Verificação no Banco de Dados Real
  const dbIndicators = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SESP-RR'));

  assert(dbIndicators.length === 128, `41. Verificação DB: Total de 128 registros consolidados (${dbIndicators.length} encontrados)`);

  const bvaHomicide = dbIndicators.find(i => i.municipalityCode === '1400100' && i.category === 'homicide' && i.period === '2024-01');
  assert(bvaHomicide?.value === 24, "42. Verificação DB: 24 vítimas de homicídio registradas em Boa Vista no período 2024-01");

  const bvaRobbery = dbIndicators.find(i => i.municipalityCode === '1400100' && i.category === 'robbery' && i.period === '2024-01');
  assert(bvaRobbery?.value === 822, "43. Verificação DB: 822 roubos em Boa Vista (650 transeunte + 90 com + 40 res + 42 coletivo)");

  const rrpRobbery = dbIndicators.find(i => i.municipalityCode === '1400472' && i.category === 'robbery' && i.period === '2024-01');
  assert(rrpRobbery?.value === 114, "44. Verificação DB: 114 roubos em Rorainópolis");

  const pacDrugs = dbIndicators.find(i => i.municipalityCode === '1400456' && i.category === 'drug_related' && i.period === '2024-01');
  assert(pacDrugs?.value === 45, "45. Verificação DB: 45 ocorrências de drogas em Pacaraima");

  const carVehTheft = dbIndicators.find(i => i.municipalityCode === '1400209' && i.category === 'vehicle_theft' && i.period === '2024-01');
  assert(carVehTheft?.value === 12, "46. Verificação DB: 12 furtos de veículos em Caracaraí");

  const cntArms = dbIndicators.find(i => i.municipalityCode === '1400175' && i.category === 'other' && i.period === '2024-01');
  assert(cntArms?.value === 4, "47. Verificação DB: 4 armas apreendidas em Cantá");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SESP-RR',
    datasetId: 'indicadores_municipais_rr',
    rawFilePath: storedWide.path,
    originalFilename: 'sesp_rr_municipios_wide_real.csv',
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
    .where(eq(securityIndicators.sourceId, 'SESP-RR'));

  assert(dbIndicatorsAfterDup.length === 128, "49. Idempotência: Contagem total inalterada no banco de dados (128 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'sesp-rr'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "50. Status da fonte SESP-RR atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SESP-RR: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSespRrAudit().catch(err => {
  console.error("Erro fatal na auditoria SESP-RR:", err);
  process.exit(1);
});
