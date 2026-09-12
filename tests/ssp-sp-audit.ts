import { SspSpAdapter } from '../src/ingestion/adapters/ssp/SspSpAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataImports, securityOccurrences, securityIndicators, geographicMunicipalities } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runAudit() {
  console.log("================================================================================");
  console.log("             AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER SSP-SP                   ");
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

  const adapter = new SspSpAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'SSP-SP' && meta.coverage === 'SP', "1. Metadata e Cobertura SSP-SP");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão periódica (YYYY-MM)");

  // 2. Schema Validation (BO, Horizontal, Vertical, Corrompido)
  const boHeaders = ['NUM_BO', 'ANO_BO', 'DATAOCORRENCIA', 'HORAOCORRENCIA', 'LOGRADOURO', 'CIDADE', 'UF', 'LATITUDE', 'LONGITUDE', 'NATUREZA_APURADA'];
  const boSchema = adapter.validateSchema(boHeaders);
  assert(boSchema.valid && boSchema.format === 'occurrences', "3. Validação de Schema - Microdados BO");

  const horizHeaders = ['MUNICIPIO', 'NATUREZA', 'ANO', 'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const horizSchema = adapter.validateSchema(horizHeaders);
  assert(horizSchema.valid && horizSchema.format === 'indicators', "4. Validação de Schema - Indicadores Horizontais");

  const vertHeaders = ['MUNICIPIO', 'NATUREZA', 'ANO', 'MES', 'TOTAL'];
  const vertSchema = adapter.validateSchema(vertHeaders);
  assert(vertSchema.valid && vertSchema.format === 'indicators', "5. Validação de Schema - Indicadores Verticais");

  const badHeaders = ['CAMPO_ALEATORIO_1', 'CAMPO_ALEATORIO_2'];
  const badSchema = adapter.validateSchema(badHeaders);
  assert(!badSchema.valid && (badSchema.missingColumns?.length || 0) > 0, "6. Validação de Schema - Rejeição de Schema Inválido no Quality Gate");

  // 3. Parsing Unitário - Meses e Anos
  const parsedVert = adapter.parseRow({
    MUNICIPIO: 'São Paulo',
    NATUREZA: 'Homicídio Doloso',
    ANO: '2024',
    MES: 'Fevereiro',
    TOTAL: '35'
  }) as any[];
  assert(Array.isArray(parsedVert) && parsedVert.length === 1 && parsedVert[0].data.period === '2024-02', "7. Parsing de Mês por extenso ('Fevereiro' -> '2024-02')");

  // 4. Parsing Unitário - Valores Especiais e Numéricos
  const parsedSpecialValues = adapter.parseRow({
    MUNICIPIO: 'Campinas',
    NATUREZA: 'Roubo de Veículo',
    ANO: '2024',
    JANEIRO: '1.450',
    FEVEREIRO: '-',
    MARCO: 'N/D',
    ABRIL: '0'
  }) as any[];
  assert(Array.isArray(parsedSpecialValues), "8. Parsing de Valores Especiais (Milhar, Traço, N/D)");
  const janRec = parsedSpecialValues.find(r => r.data.period === '2024-01');
  const fevRec = parsedSpecialValues.find(r => r.data.period === '2024-02');
  const marRec = parsedSpecialValues.find(r => r.data.period === '2024-03');
  assert(janRec?.data.value === 1450, "9. Tratamento de separador de milhar ('1.450' -> 1450)");
  assert(fevRec?.data.value === 0 && marRec?.data.value === 0, "10. Tratamento de valores nulos ('-' e 'N/D' -> 0)");

  // 5. Categorias Canônicas e Categorias Desconhecidas
  assert(adapter.mapCrimeToCanonical('HOMICÍDIO DOLOSO') === 'homicide', "11. Mapeamento Canônico: Homicídio Doloso");
  assert(adapter.mapCrimeToCanonical('LATROCÍNIO') === 'homicide', "12. Mapeamento Canônico: Latrocínio");
  assert(adapter.mapCrimeToCanonical('ROUBO DE VEÍCULO') === 'vehicle_robbery', "13. Mapeamento Canônico: Roubo de Veículo");
  assert(adapter.mapCrimeToCanonical('FURTO DE VEÍCULO') === 'vehicle_theft', "14. Mapeamento Canônico: Furto de Veículo");
  assert(adapter.mapCrimeToCanonical('ROUBO DE CARGA') === 'cargo_theft', "15. Mapeamento Canônico: Roubo de Carga");
  assert(adapter.mapCrimeToCanonical('ESTUPRO DE VULNERÁVEL') === 'sexual_crime', "16. Mapeamento Canônico: Estupro");
  assert(adapter.mapCrimeToCanonical('TRÁFICO DE ENTORPECENTES') === 'drug_related', "17. Mapeamento Canônico: Entorpecentes");
  assert(adapter.mapCrimeToCanonical('CRIME CIBERNÉTICO NUNCA VISTO') === 'other', "18. Categoria Desconhecida mapeia com segurança para 'other'");

  // 6. Normalização Geográfica e Nomes Divergentes
  const aliasCapital = GeoNormalizationService.canonicalizeMunicipalityName('Capital');
  const aliasSBC = GeoNormalizationService.canonicalizeMunicipalityName('S. Bernardo do Campo');
  const aliasMoji = GeoNormalizationService.canonicalizeMunicipalityName('Moji Mirim');
  assert(aliasCapital === 'sao paulo', "19. Resolução de alias 'Capital' -> 'sao paulo'");
  assert(aliasSBC === 'sao bernardo do campo', "20. Resolução de alias 'S. Bernardo do Campo'");
  assert(aliasMoji === 'mogi mirim', "21. Resolução de grafia arcaica 'Moji Mirim' -> 'mogi mirim'");

  // 7. Execução End-to-End no Pipeline com Arquivo Real de BO
  console.log("\n--- TESTE END-TO-END: PIPELINE COMPLETO COM FIXTURE REAL DE BO ---");
  const boFixturePath = path.resolve('tests/fixtures/ssp/ssp_sp_bo_real.csv');
  const boStream = fs.createReadStream(boFixturePath);
  
  // Step 7: Armazenamento RAW
  const storedBo = await rawStorage.put('ssp', `audit_${Date.now()}`, 'ssp_sp_bo_real.csv', boStream);
  assert(fs.existsSync(storedBo.path), "22. Armazenamento RAW da fonte SSP-SP");

  // Step 8: Criação do Job via JobManager
  const jobResult = await JobManager.createJob({
    sourceId: 'SSP-SP',
    datasetId: 'ocorrencias_criminais_sp',
    rawFilePath: storedBo.path,
    originalFilename: 'ssp_sp_bo_real.csv',
    checksum: storedBo.metadata.checksum,
    fileSize: storedBo.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "23. Criação e agendamento de Job para SSP-SP");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob, "24. Job persistido no banco com status QUEUED");

  // Step 9 a 20: Execução pelo IngestionWorker
  const worker = new IngestionWorker('audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "25. Execução bem sucedida do Job pelo Worker");
  assert(runResult.metrics.recordsRead === 11, `26. Registros lidos com sucesso (11 linhas na fixture)`);
  assert(runResult.metrics.recordsDuplicate === 1, `27. Deduplicação bem sucedida (1 duplicata evitada no lote)`);
  assert(runResult.metrics.recordsWithoutCoordinates === 1, `28. Detecção de registro sem coordenadas no Quality Gate`);

  // Verificação de Persistência no Banco de Dados
  const occurrencesInDb = await db
    .select()
    .from(securityOccurrences)
    .where(eq(securityOccurrences.sourceId, 'SSP-SP'));
  assert(occurrencesInDb.length >= 9, `29. Ocorrências persistidas com sucesso no banco (${occurrencesInDb.length} encontradas)`);

  // Verificação de Atributos Canônicos
  const spRecord = occurrencesInDb.find(o => o.sourceRecordId === '2024-10234');
  assert(spRecord?.stateCode === 'SP' && spRecord?.category === 'vehicle_robbery', "30. Persistência correta de atributos canônicos");

  // 8. Teste de Idempotência e Reprocessamento
  console.log("\n--- TESTE DE IDEMPOTÊNCIA: REPROCESSAMENTO DO MESMO ARQUIVO ---");
  const reprocessJob = await JobManager.reprocessJob(dbJob.id);
  assert(!!reprocessJob && !!reprocessJob.job, "31. Reprocessamento de Job suportado");
  const reprocessResult = await worker.processJobDirectly(reprocessJob.job);
  assert(reprocessResult.success, "32. Reprocessamento concluído com sucesso");
  
  const occurrencesAfterReprocess = await db
    .select()
    .from(securityOccurrences)
    .where(eq(securityOccurrences.sourceId, 'SSP-SP'));
  assert(occurrencesAfterReprocess.length === occurrencesInDb.length, "33. Idempotência garantida: contagem inalterada após reprocessamento");

  // 9. Execução End-to-End com Tabela Horizontal de Indicadores
  console.log("\n--- TESTE END-TO-END: INDICADORES HORIZONTAIS ---");
  const horizFixturePath = path.resolve('tests/fixtures/ssp/ssp_sp_indicadores_horizontal.csv');
  const horizStream = fs.createReadStream(horizFixturePath);
  const storedHoriz = await rawStorage.put('ssp', `audit_horiz_${Date.now()}`, 'ssp_sp_indicadores_horizontal.csv', horizStream);

  const horizJobResult = await JobManager.createJob({
    sourceId: 'SSP-SP',
    datasetId: 'indicadores_municipais_sp',
    rawFilePath: storedHoriz.path,
    originalFilename: 'ssp_sp_indicadores_horizontal.csv',
    checksum: storedHoriz.metadata.checksum,
    fileSize: storedHoriz.metadata.size,
    force: true
  });
  const [dbHorizJob] = await db.select().from(dataImports).where(eq(dataImports.id, horizJobResult.jobId));
  const horizExecResult = await worker.processJobDirectly(dbHorizJob);
  assert(horizExecResult.success, "34. Ingestão de Indicadores Horizontais pelo pipeline");

  const indicatorsInDb = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'SSP-SP'));
  assert(indicatorsInDb.length > 0, `35. Indicadores agregados persistidos no banco (${indicatorsInDb.length} registros)`);

  // 10. Execução End-to-End com Tabela Vertical de Indicadores
  console.log("\n--- TESTE END-TO-END: INDICADORES VERTICAIS ---");
  const vertFixturePath = path.resolve('tests/fixtures/ssp/ssp_sp_indicadores_vertical.csv');
  const vertStream = fs.createReadStream(vertFixturePath);
  const storedVert = await rawStorage.put('ssp', `audit_vert_${Date.now()}`, 'ssp_sp_indicadores_vertical.csv', vertStream);

  const vertJobResult = await JobManager.createJob({
    sourceId: 'SSP-SP',
    datasetId: 'indicadores_municipais_sp',
    rawFilePath: storedVert.path,
    originalFilename: 'ssp_sp_indicadores_vertical.csv',
    checksum: storedVert.metadata.checksum,
    fileSize: storedVert.metadata.size,
    force: true
  });
  const [dbVertJob] = await db.select().from(dataImports).where(eq(dataImports.id, vertJobResult.jobId));
  const vertExecResult = await worker.processJobDirectly(dbVertJob);
  assert(vertExecResult.success, "36. Ingestão de Indicadores Verticais pelo pipeline");

  // 11. Consulta Pública aos Dados Ingeridos
  console.log("\n--- TESTE DE CONSULTA PÚBLICA ---");
  const spIndicators = await db
    .select()
    .from(securityIndicators)
    .where(and(eq(securityIndicators.sourceId, 'SSP-SP'), eq(securityIndicators.stateCode, 'SP')));
  assert(spIndicators.length > 0, `37. Consulta pública de indicadores de SP retornou ${spIndicators.length} registros`);

  const mappedOccurrences = occurrencesInDb.filter(o => o.latitude !== null && o.longitude !== null);
  assert(mappedOccurrences.length > 0, `38. Consulta de ocorrências para mapa possui ${mappedOccurrences.length} registros georreferenciados`);

  console.log("\n================================================================================");
  console.log(`TOTAL DE VALIDAÇÕES: ${passed + failed} | APROVADOS: ${passed} | FALHAS: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error("Erro fatal na auditoria:", err);
  process.exit(1);
});
