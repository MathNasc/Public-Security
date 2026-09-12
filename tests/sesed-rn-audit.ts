import { SesedRnAdapter } from '../src/ingestion/adapters/sesed-rn/SesedRnAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runSesedRnAudit() {
  console.log("================================================================================");
  console.log("    AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SESED-RN (RIO GRANDE DO NORTE)   ");
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

  // 0. Assegurar Fonte SESED-RN no Banco de Dados
  await db.delete(securityIndicators).where(eq(securityIndicators.sourceId, 'SESED-RN'));

  const rnSource = await db.select().from(dataSources).where(sql`lower(id) = 'sesed-rn'`);
  if (rnSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SESED-RN',
      name: 'Secretaria de Estado da Segurança Pública e da Defesa Social do Rio Grande do Norte',
      provider: 'SESED-RN / COINE',
      coverage: 'RN',
      state: 'RN',
      sourceType: 'csv',
      url: 'https://www.seguranca.rn.gov.br/estatisticas',
      officialUrl: 'https://www.seguranca.rn.gov.br/',
      documentationUrl: 'https://transparencia.rn.gov.br/',
      description: 'Estatísticas criminais consolidadas pela SESED-RN e Coordenadoria de Informações Estatísticas e Análise Criminal (COINE).',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const adapter = new SesedRnAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SESED-RN' && meta.coverage === 'RN' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do Rio Grande do Norte");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'SESED-RN' && discovery.url.includes('seguranca.rn.gov.br'), "3. Discovery oficial apontando para repositório do RN");

  // 2. Schema Validation (Quality Gate)
  const wideHeaders = ['cod_ibge', 'municipio', 'ano', 'mes', 'homicidio_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas'];
  const wideSchema = adapter.validateSchema(wideHeaders);
  assert(wideSchema.valid && wideSchema.format === 'indicators', "4. Quality Gate: Validação de Schema Matricial Municipal (Padrão SESED-RN)");

  const verticalHeaders = ['municipio', 'ano', 'mes', 'natureza', 'quantidade'];
  const verticalSchema = adapter.validateSchema(verticalHeaders);
  assert(verticalSchema.valid && verticalSchema.format === 'indicators', "5. Quality Gate: Validação de Schema Vertical por Natureza Criminal");

  const corruptedHeaders = ['COLUNA_DESCONHECIDA_RN_A', 'COLUNA_DESCONHECIDA_RN_B'];
  const corruptedSchema = adapter.validateSchema(corruptedHeaders);
  assert(!corruptedSchema.valid && (corruptedSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Incompatível");

  // 3. Parsing Unitário: Formato Matricial (Wide)
  const parsedWide = adapter.parseRow({
    cod_ibge: '2408102',
    municipio: 'Natal',
    ano: '2024',
    mes: '1',
    homicidio_doloso: '28',
    latrocinio: '2',
    feminicidio: '1',
    lesao_morte: '1',
    roubo_veiculo: '140',
    furto_veiculo: '115',
    roubo_transeunte: '620',
    roubo_comercio: '110',
    roubo_residencia: '45',
    roubo_coletivo: '55',
    furto: '980',
    estupro: '32',
    trafico_drogas: '210',
    apreensao_armas: '85'
  });

  const wideList = Array.isArray(parsedWide) ? parsedWide : [];
  assert(Array.isArray(parsedWide) && wideList.length === 8, "7. Parsing Matricial: Decomposição em 8 indicadores canônicos");
  
  const homInd = wideList.find(r => r.data.category === 'homicide');
  assert(homInd?.data.value === 32 && homInd?.data.period === '2024-01', "8. Indicador de Homicídios (CVLI): Soma correta (28 dolosos + 2 latrocínio + 1 feminicídio + 1 lesão morte = 32)");

  const robInd = wideList.find(r => r.data.category === 'robbery');
  assert(robInd?.data.value === 830, "9. Indicador de Roubos (CVP): Agregação de Transeunte (620) + Comércio (110) + Residência (45) + Coletivo (55) = 830");

  const vehRobInd = wideList.find(r => r.data.category === 'vehicle_robbery');
  assert(vehRobInd?.data.value === 140, "10. Indicador de Roubo de Veículos normalizado corretamente (140)");

  const vehTheftInd = wideList.find(r => r.data.category === 'vehicle_theft');
  assert(vehTheftInd?.data.value === 115, "11. Indicador de Furto de Veículos normalizado corretamente (115)");

  const theftInd = wideList.find(r => r.data.category === 'theft');
  assert(theftInd?.data.value === 980, "12. Indicador de Furtos Gerais normalizado corretamente (980)");

  const drugInd = wideList.find(r => r.data.category === 'drug_related');
  assert(drugInd?.data.value === 210, "13. Indicador de Tráfico de Entorpecentes normalizado corretamente (210)");

  const armsInd = wideList.find(r => r.data.category === 'other');
  assert(armsInd?.data.value === 85 && armsInd?.data.unit === 'armas', "14. Indicador de Apreensão de Armas de Fogo normalizado (85 armas)");

  // 4. Parsing Unitário: Formato Vertical
  const parsedVertical = adapter.parseRow({
    cod_ibge: '2408102',
    municipio: 'Natal',
    ano: '2024',
    mes: 'Fevereiro',
    natureza: 'Roubo em Ônibus',
    total: '45'
  });
  const vertList = Array.isArray(parsedVertical) ? parsedVertical : [];
  assert(Array.isArray(parsedVertical) && vertList.length === 1, "15. Parsing Vertical: Geração de indicador único");
  assert(vertList[0]?.data.category === 'robbery' && vertList[0]?.data.period === '2024-02', "16. Mapeamento correto de Roubo em Ônibus e mês por extenso");

  // 5. Mapeamento Canônico de Taxonomia Criminal
  assert(adapter.mapCrimeToCanonical('Condutas Violentas Letais Intencionais') === 'homicide', "17. Taxonomia: CVLI -> homicide");
  assert(adapter.mapCrimeToCanonical('Feminicídio') === 'homicide', "18. Taxonomia: Feminicídio -> homicide");
  assert(adapter.mapCrimeToCanonical('Roubo em Via Pública') === 'robbery', "19. Taxonomia: Roubo em Via Pública -> robbery");
  assert(adapter.mapCrimeToCanonical('Tentativa de Homicídio') === 'bodily_harm', "20. Taxonomia: Tentativa de Homicídio -> bodily_harm");
  assert(adapter.mapCrimeToCanonical('Estupro de Vulnerável') === 'sexual_crime', "21. Taxonomia: Estupro de Vulnerável -> sexual_crime");
  assert(adapter.mapCrimeToCanonical('Roubo de Carga') === 'cargo_theft', "22. Taxonomia: Roubo de Carga -> cargo_theft");

  // 6. Normalização Geográfica para Municípios Potiguares
  const natNorm = GeoNormalizationService.canonicalizeMunicipalityName('Natal');
  assert(natNorm === 'natal', "23. Geo Normalization: Natal");

  const mosNorm = GeoNormalizationService.canonicalizeMunicipalityName('Mossoró');
  assert(mosNorm === 'mossoro', "24. Geo Normalization: Mossoró");

  const parNorm = GeoNormalizationService.canonicalizeMunicipalityName('Parnamirim');
  assert(parNorm === 'parnamirim', "25. Geo Normalization: Parnamirim");

  const sgaNorm = GeoNormalizationService.canonicalizeMunicipalityName('São Gonçalo do Amarante');
  assert(sgaNorm === 'sao goncalo do amarante', "26. Geo Normalization: São Gonçalo do Amarante");

  const macNorm = GeoNormalizationService.canonicalizeMunicipalityName('Macaíba');
  assert(macNorm === 'macaiba', "27. Geo Normalization: Macaíba");

  const natAlias = GeoNormalizationService.canonicalizeMunicipalityName('NAT');
  assert(natAlias === 'natal', "28. Geo Normalization: Alias 'NAT' -> 'natal'");

  const assuAlias = GeoNormalizationService.canonicalizeMunicipalityName('Assu');
  assert(assuAlias === 'acu', "29. Geo Normalization: Alias 'Assu' -> 'acu'");

  const cearaMirimAlias = GeoNormalizationService.canonicalizeMunicipalityName('Ceara Mirim');
  assert(cearaMirimAlias === 'ceara-mirim', "30. Geo Normalization: Alias 'Ceara Mirim' -> 'ceara-mirim'");

  // 7. Pipeline End-to-End com IngestionWorker e Fixture Real (Wide)
  const wideFixturePath = path.resolve('tests/fixtures/sesed-rn/sesed_rn_municipios_wide_real.csv');
  assert(fs.existsSync(wideFixturePath), "31. Fixture CSV Wide de municípios potiguares existe no disco");

  const wideStream = fs.createReadStream(wideFixturePath);
  const storedWide = await rawStorage.put('sesed-rn', `audit_${Date.now()}`, 'sesed_rn_municipios_wide_real.csv', wideStream);
  assert(fs.existsSync(storedWide.path) && storedWide.metadata.size > 0, "32. Armazenamento RAW da fonte SESED-RN com SHA-256 e bytes calculados");

  const jobResult = await JobManager.createJob({
    sourceId: 'SESED-RN',
    datasetId: 'indicadores_municipais_rn',
    rawFilePath: storedWide.path,
    originalFilename: 'sesed_rn_municipios_wide_real.csv',
    checksum: storedWide.metadata.checksum,
    fileSize: storedWide.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "33. Criação e agendamento de Job de Ingestão para SESED-RN");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "34. Job persistido no banco com status QUEUED");

  const worker = new IngestionWorker('sesed-rn-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "35. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 16, `36. 16 municípios do RN processados (${runResult.metrics.recordsRead} lidos)`);
  assert(runResult.metrics.recordsInserted === 128, `37. 128 indicadores inseridos com sucesso (${runResult.metrics.recordsInserted} inseridos)`);

  // 8. Pipeline End-to-End com Fixture Vertical
  const verticalFixturePath = path.resolve('tests/fixtures/sesed-rn/sesed_rn_vertical_real.csv');
  const vertStream = fs.createReadStream(verticalFixturePath);
  const storedVert = await rawStorage.put('sesed-rn', `audit_vert_${Date.now()}`, 'sesed_rn_vertical_real.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SESED-RN',
    datasetId: 'indicadores_municipais_rn',
    rawFilePath: storedVert.path,
    originalFilename: 'sesed_rn_vertical_real.csv',
    checksum: storedVert.metadata.checksum,
    fileSize: storedVert.metadata.size,
    force: true
  });

  const [dbVertJob] = await db.select().from(dataImports).where(eq(dataImports.id, vertJobResult.jobId));
  const vertRunResult = await worker.processJobDirectly(dbVertJob);
  assert(vertRunResult.success, "38. Processamento do Job SESED-RN (Vertical) concluído com sucesso");
  assert(vertRunResult.metrics.recordsInserted === 8, "39. Métrica: 8 indicadores inseridos a partir do dataset vertical");

  // 9. Quality Gate: Rejeição de Arquivo com Schema Incompatível
  const corruptFixturePath = path.resolve('tests/fixtures/sesed-rn/sesed_rn_corrupted_schema.csv');
  const corruptStream = fs.createReadStream(corruptFixturePath);
  const storedCorrupt = await rawStorage.put('sesed-rn', `audit_corrupt_${Date.now()}`, 'sesed_rn_corrupted_schema.csv', corruptStream);

  const corruptJobResult = await JobManager.createJob({
    sourceId: 'SESED-RN',
    datasetId: 'indicadores_municipais_rn',
    rawFilePath: storedCorrupt.path,
    originalFilename: 'sesed_rn_corrupted_schema.csv',
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
    .where(eq(securityIndicators.sourceId, 'SESED-RN'));

  assert(dbIndicators.length === 136, `42. Verificação DB: Total de 136 registros consolidados (${dbIndicators.length} encontrados)`);

  const natHomicide = dbIndicators.find(i => i.municipalityCode === '2408102' && i.category === 'homicide' && i.period === '2024-01');
  assert(natHomicide?.value === 32, "43. Verificação DB: 32 vítimas de homicídio registradas em Natal no período 2024-01");

  const natRobbery = dbIndicators.find(i => i.municipalityCode === '2408102' && i.category === 'robbery' && i.period === '2024-01');
  assert(natRobbery?.value === 830, "44. Verificação DB: 830 roubos em Natal (620 transeunte + 110 com + 45 res + 55 coletivo)");

  const mosRobbery = dbIndicators.find(i => i.municipalityCode === '2408003' && i.category === 'robbery' && i.period === '2024-01');
  assert(mosRobbery?.value === 382, "45. Verificação DB: 382 roubos em Mossoró");

  const parVeh = dbIndicators.find(i => i.municipalityCode === '2403251' && i.category === 'vehicle_robbery' && i.period === '2024-01');
  assert(parVeh?.value === 55, "46. Verificação DB: 55 roubos de veículos em Parnamirim");

  const sgaDrug = dbIndicators.find(i => i.municipalityCode === '2412005' && i.category === 'drug_related' && i.period === '2024-01');
  assert(sgaDrug?.value === 56, "47. Verificação DB: 56 ocorrências de drogas em São Gonçalo do Amarante");

  const macTheft = dbIndicators.find(i => i.municipalityCode === '2407104' && i.category === 'theft' && i.period === '2024-01');
  assert(macTheft?.value === 160, "48. Verificação DB: 160 furtos em Macaíba");

  // 11. Teste de Idempotência e Deduplicação
  console.log("[TEST] Executando re-ingestão do mesmo dataset wide para validar idempotência...");
  const dupJobResult = await JobManager.createJob({
    sourceId: 'SESED-RN',
    datasetId: 'indicadores_municipais_rn',
    rawFilePath: storedWide.path,
    originalFilename: 'sesed_rn_municipios_wide_real.csv',
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
    .where(eq(securityIndicators.sourceId, 'SESED-RN'));

  assert(dbIndicatorsAfterDup.length === 136, "50. Idempotência: Contagem total inalterada no banco de dados (136 registros)");

  // 12. Validação de Integridade do Status da Fonte
  const sourceCheck = await db.select().from(dataSources).where(sql`lower(id) = 'sesed-rn'`);
  assert(sourceCheck[0]?.status === 'OPERATIONAL', "51. Status da fonte SESED-RN atualizado para OPERATIONAL");

  console.log("================================================================================");
  console.log(`RESULTADO DA AUDITORIA SESED-RN: ${passed} PASSOU | ${failed} FALHOU`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSesedRnAudit().catch(err => {
  console.error("Erro fatal na auditoria SESED-RN:", err);
  process.exit(1);
});
