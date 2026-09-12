import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataImports, securityOccurrences, securityIndicators } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

async function runE2ETests() {
  console.log('=== TESTE E2E DO PIPELINE OFICIAL DE INGESTÃO (22 ETAPAS) ===\n');
  const worker = new IngestionWorker();

  // -------------------------------------------------------------
  // TESTE 1: Ingestão de Ocorrências Reais SSP-SP (Microdados com Georreferenciamento)
  // -------------------------------------------------------------
  console.log('[TESTE 1] Ingestão de ocorrências SSP-SP (Microdados com BO, lat/lon e endereço)...');
  const sspSamplePath = path.join(process.cwd(), 'uploads/ssp-sample.csv');
  const sspFileContent = fs.readFileSync(sspSamplePath);
  const sspChecksum = crypto.createHash('sha256').update(sspFileContent).digest('hex');

  const sspJobResult = await JobManager.createJob({
    sourceId: 'SSP-SP',
    datasetId: 'ocorrencias_criminais_sp',
    rawFilePath: 'uploads/ssp-sample.csv',
    originalFilename: 'ssp-sample.csv',
    checksum: sspChecksum,
    fileSize: sspFileContent.length
  });

  console.log(`Job criado: ${sspJobResult.jobId} (isDuplicate: ${sspJobResult.isDuplicate})`);
  const sspJob = await JobManager.getJob(sspJobResult.jobId);
  const sspExec = await worker.processJobDirectly(sspJob);

  if (!sspExec.success) {
    throw new Error(`Falha no TESTE 1: ${sspExec.error}`);
  }
  console.log(`Resultado TESTE 1:`, sspExec.metrics);

  const occs = await db.select().from(securityOccurrences).where(eq(securityOccurrences.sourceId, 'SSP-SP'));
  console.log(`Total de ocorrências salvas no banco para SSP-SP: ${occs.length}`);
  if (occs.length === 0) throw new Error('Nenhuma ocorrência persistida!');
  console.log('Exemplo de registro salvo:', {
    id: occs[0].id,
    category: occs[0].category,
    municipality: occs[0].municipalityName,
    lat: occs[0].latitude,
    lon: occs[0].longitude,
    address: occs[0].originalAddress
  });
  console.log('>>> TESTE 1 APROVADO COM SUCESSO!\n');

  // -------------------------------------------------------------
  // TESTE 2: Idempotência (Tentar importar o mesmo arquivo novamente)
  // -------------------------------------------------------------
  console.log('[TESTE 2] Testando Idempotência com o mesmo arquivo e checksum...');
  const sspDupResult = await JobManager.createJob({
    sourceId: 'SSP-SP',
    datasetId: 'ocorrencias_criminais_sp',
    rawFilePath: 'uploads/ssp-sample.csv',
    originalFilename: 'ssp-sample.csv',
    checksum: sspChecksum,
    fileSize: sspFileContent.length
  });

  console.log(`Tentativa de duplicata: isDuplicate=${sspDupResult.isDuplicate}, status=${sspDupResult.status}`);
  if (!sspDupResult.isDuplicate) {
    throw new Error('Falha na detecção de duplicata!');
  }
  console.log('>>> TESTE 2 APROVADO COM SUCESSO!\n');

  // -------------------------------------------------------------
  // TESTE 3: Ingestão de Indicadores Municipais Reais SINESP
  // -------------------------------------------------------------
  console.log('[TESTE 3] Ingestão de indicadores municipais SINESP...');
  const sinespPath = path.join(process.cwd(), 'raw_storage/indicadores_municipais/2024-01/sinesp_sample.csv');
  const sinespContent = fs.readFileSync(sinespPath);
  const sinespChecksum = crypto.createHash('sha256').update(sinespContent).digest('hex');

  const sinespJobResult = await JobManager.createJob({
    sourceId: 'SINESP',
    datasetId: 'indicadores_municipais',
    rawFilePath: 'raw_storage/indicadores_municipais/2024-01/sinesp_sample.csv',
    originalFilename: 'sinesp_sample.csv',
    checksum: sinespChecksum,
    fileSize: sinespContent.length
  });

  const sinespJob = await JobManager.getJob(sinespJobResult.jobId);
  const sinespExec = await worker.processJobDirectly(sinespJob);

  if (!sinespExec.success) {
    throw new Error(`Falha no TESTE 3: ${sinespExec.error}`);
  }
  console.log(`Resultado TESTE 3:`, sinespExec.metrics);

  const inds = await db.select().from(securityIndicators).where(eq(securityIndicators.sourceId, 'SINESP'));
  console.log(`Total de indicadores salvos no banco para SINESP: ${inds.length}`);
  if (inds.length === 0) throw new Error('Nenhum indicador persistido!');
  console.log('Exemplo de indicador salvo:', {
    id: inds[0].id,
    stateCode: inds[0].stateCode,
    municipalityCode: inds[0].municipalityCode,
    category: inds[0].category,
    period: inds[0].period,
    value: inds[0].value
  });
  console.log('>>> TESTE 3 APROVADO COM SUCESSO!\n');

  // -------------------------------------------------------------
  // TESTE 4: Quality Gate - Rejeição por Schema Inválido
  // -------------------------------------------------------------
  console.log('[TESTE 4] Testando Quality Gate com Schema Inválido...');
  const invalidSchemaPath = path.join(process.cwd(), 'data/invalid_schema.csv');
  fs.writeFileSync(invalidSchemaPath, 'ID_FAKE,VALOR_ALEATORIO,COMENTARIO\n1,100,teste\n2,200,teste2\n');
  const invalidContent = fs.readFileSync(invalidSchemaPath);
  const invalidChecksum = crypto.createHash('sha256').update(invalidContent).digest('hex');

  const invalidJobResult = await JobManager.createJob({
    sourceId: 'SSP-SP',
    datasetId: 'ocorrencias_criminais_sp',
    rawFilePath: 'data/invalid_schema.csv',
    originalFilename: 'invalid_schema.csv',
    checksum: invalidChecksum,
    fileSize: invalidContent.length
  });

  const invalidJob = await JobManager.getJob(invalidJobResult.jobId);
  const invalidExec = await worker.processJobDirectly(invalidJob);

  console.log(`Execução com schema inválido: success=${invalidExec.success}, error="${invalidExec.error}"`);
  if (invalidExec.success) {
    throw new Error('Falha no Quality Gate: arquivo com schema inválido não deveria ter sido aceito!');
  }

  const updatedInvalidJob = await JobManager.getJob(invalidJobResult.jobId);
  console.log(`Status do Job no banco após falha no Quality Gate: ${updatedInvalidJob?.status} (lastError: ${updatedInvalidJob?.lastError})`);
  if (updatedInvalidJob?.status !== 'FAILED') {
    throw new Error(`Status deveria ser FAILED, obteve: ${updatedInvalidJob?.status}`);
  }
  console.log('>>> TESTE 4 APROVADO COM SUCESSO!\n');

  // -------------------------------------------------------------
  // TESTE 5: Quality Gate - Rejeição por Arquivo Vazio (0 bytes)
  // -------------------------------------------------------------
  console.log('[TESTE 5] Testando Quality Gate com Arquivo Vazio (0 bytes)...');
  const emptyPath = path.join(process.cwd(), 'data/empty_file.csv');
  fs.writeFileSync(emptyPath, '');

  const emptyJobResult = await JobManager.createJob({
    sourceId: 'SSP-SP',
    datasetId: 'ocorrencias_criminais_sp',
    rawFilePath: 'data/empty_file.csv',
    originalFilename: 'empty_file.csv',
    checksum: 'empty-sha',
    fileSize: 0
  });

  const emptyJob = await JobManager.getJob(emptyJobResult.jobId);
  const emptyExec = await worker.processJobDirectly(emptyJob);

  console.log(`Execução com arquivo vazio: success=${emptyExec.success}, error="${emptyExec.error}"`);
  if (emptyExec.success) {
    throw new Error('Quality Gate deveria ter rejeitado arquivo de 0 bytes!');
  }
  console.log('>>> TESTE 5 APROVADO COM SUCESSO!\n');

  // -------------------------------------------------------------
  // TESTE 6: Reprocessamento Oficial de Job
  // -------------------------------------------------------------
  console.log('[TESTE 6] Testando Reprocessamento oficial via JobManager...');
  // Reprocessa o job do SINESP com sucesso
  const reprocessResult = await JobManager.reprocessJob(sinespJobResult.jobId);
  console.log(`JobManager.reprocessJob resultado:`, reprocessResult);

  const resetJob = await JobManager.getJob(sinespJobResult.jobId);
  console.log(`Status do Job após reset: ${resetJob?.status}, checkpoint=${resetJob?.checkpoint}`);
  if (resetJob?.status !== 'QUEUED') {
    throw new Error('Job deveria estar com status QUEUED após reprocessJob!');
  }

  // Executa novamente
  const reprocessExec = await worker.processJobDirectly(resetJob);
  console.log(`Re-execução do Job: success=${reprocessExec.success}, registros=${reprocessExec.metrics.recordsInserted}`);
  if (!reprocessExec.success) {
    throw new Error(`Falha na re-execução: ${reprocessExec.error}`);
  }
  console.log('>>> TESTE 6 APROVADO COM SUCESSO!\n');

  console.log('===============================================================');
  console.log('TODOS OS TESTES DO PIPELINE FORAM EXECUTADOS COM 100% DE SUCESSO!');
  console.log('===============================================================');
}

runE2ETests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('ERRO FATAL NOS TESTES:', err);
    process.exit(1);
  });
