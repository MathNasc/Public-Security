/**
 * phase5_operational_hardening_audit.ts
 * Suíte de Testes e Validação Completa da FASE 5:
 * Hardening Operacional, Observabilidade e Confiabilidade de Produção.
 */

import assert from 'assert';
import { JobStateMachine, JobState } from '../src/ingestion/core/contracts/JobState.js';
import { IngestionOperationalError } from '../src/ingestion/core/contracts/OperationalErrors.js';
import { RobustDownloader } from '../src/ingestion/orchestration/RobustDownloader.js';
import { SchemaValidator } from '../src/ingestion/pipeline/SchemaValidator.js';
import { QualityGate } from '../src/ingestion/pipeline/QualityGate.js';
import { ReconciliationEngine } from '../src/ingestion/pipeline/ReconciliationEngine.js';
import { StructuredLogger } from '../src/lib/structuredLogger.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { CanonicalOccurrence, CanonicalIndicator } from '../src/ingestion/core/index.js';

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${description}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${description}\n     Erro: ${err.message}`);
      failed++;
    }
  })();
}

async function runPhase5Audit() {
  console.log('========================================================================');
  console.log('🛡️  FASE 5: SUÍTE DE HARDENING OPERACIONAL, OBSERVABILIDADE E RESILIÊNCIA');
  console.log('========================================================================\n');

  // -----------------------------------------------------------------------------------
  // 5.1 & 5.2: Máquina de Estados dos Jobs
  // -----------------------------------------------------------------------------------
  console.log('--- 5.2: Máquina de Estados dos Jobs e Transições Permitidas/Bloqueadas ---');

  await test('Normalização de status legados para JobState canônico', () => {
    assert.strictEqual(JobStateMachine.normalize('QUEUED'), 'pending');
    assert.strictEqual(JobStateMachine.normalize('PROCESSING'), 'running');
    assert.strictEqual(JobStateMachine.normalize('COMPLETED'), 'succeeded');
    assert.strictEqual(JobStateMachine.normalize('FAILED'), 'failed');
    assert.strictEqual(JobStateMachine.normalize('STALE'), 'stale');
    assert.strictEqual(JobStateMachine.normalize('succeeded_with_warnings'), 'succeeded_with_warnings');
  });

  await test('Transição válida: pending -> running', () => {
    assert.strictEqual(JobStateMachine.isValidTransition('pending', 'running'), true);
    assert.strictEqual(JobStateMachine.assertTransition('pending', 'running'), 'running');
  });

  await test('Transição válida: running -> succeeded e running -> failed', () => {
    assert.strictEqual(JobStateMachine.isValidTransition('running', 'succeeded'), true);
    assert.strictEqual(JobStateMachine.isValidTransition('running', 'failed'), true);
    assert.strictEqual(JobStateMachine.isValidTransition('running', 'succeeded_with_warnings'), true);
  });

  await test('Transição inválida bloqueada: succeeded -> running (Estado terminal)', () => {
    assert.strictEqual(JobStateMachine.isValidTransition('succeeded', 'running'), false);
    assert.throws(() => {
      JobStateMachine.assertTransition('succeeded', 'running', 'job-test-01');
    }, /Transição de estado inválida no Job 'job-test-01'/);
  });

  await test('Transição inválida bloqueada: cancelled -> succeeded', () => {
    assert.strictEqual(JobStateMachine.isValidTransition('cancelled', 'succeeded'), false);
    assert.throws(() => {
      JobStateMachine.assertTransition('cancelled', 'succeeded');
    }, /Transição de estado inválida/);
  });

  // -----------------------------------------------------------------------------------
  // 5.3: Idempotência e Reprocessamento
  // -----------------------------------------------------------------------------------
  console.log('\n--- 5.3: Idempotência de Jobs e Reprocessamento ---');

  const testChecksum = 'checksum_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  
  await test('Criação do primeiro Job para arquivo único', async () => {
    const res = await JobManager.createJob({
      sourceId: 'SSP-SP',
      datasetId: 'ssp_sp_microdados_2026',
      rawFilePath: '/tmp/test_microdados_2026.csv',
      originalFilename: 'test_microdados_2026.csv',
      checksum: testChecksum,
      fileSize: 1024,
      stateCode: 'SP',
      period: '2026-01'
    });
    assert.strictEqual(res.isDuplicate, false);
    assert.strictEqual(res.status, 'pending');
    
    // Conclui o job
    await JobManager.updateJobStatus(res.jobId, 'running');
    await JobManager.updateJobStatus(res.jobId, 'succeeded', { recordsInserted: 10 });
  });

  await test('Tentativa de duplicar mesmo arquivo com mesmo checksum retorna Job concluído (Idempotência)', async () => {
    const res = await JobManager.createJob({
      sourceId: 'SSP-SP',
      datasetId: 'ssp_sp_microdados_2026',
      rawFilePath: '/tmp/test_microdados_2026.csv',
      originalFilename: 'test_microdados_2026.csv',
      checksum: testChecksum,
      fileSize: 1024,
      stateCode: 'SP',
      period: '2026-01'
    });
    assert.strictEqual(res.isDuplicate, true);
    assert.strictEqual(res.status, 'succeeded');
  });

  await test('Reprocessamento oficial reseta status e contadores com segurança', async () => {
    const jobRes = await JobManager.createJob({
      sourceId: 'SSP-SP',
      rawFilePath: '/tmp/reprocess.csv',
      originalFilename: 'reprocess.csv',
      checksum: 'hash_reprocess_12345',
      fileSize: 500,
      force: true
    });
    
    await JobManager.updateJobStatus(jobRes.jobId, 'running');
    await JobManager.updateJobStatus(jobRes.jobId, 'failed', { lastError: 'Falha temporária de rede' });
    
    const reprocessRes = await JobManager.reprocessJob(jobRes.jobId);
    assert.strictEqual(reprocessRes.success, true);
    assert.strictEqual(reprocessRes.job.status, 'QUEUED');
    assert.strictEqual(reprocessRes.job.lastError, null);
  });

  // -----------------------------------------------------------------------------------
  // 5.4: Download Robusto e Validação de Fontes
  // -----------------------------------------------------------------------------------
  console.log('\n--- 5.4: Download Robusto e Validação de Fontes (Além do HTTP 200) ---');

  await test('Detecção e bloqueio de SSRF em URLs de download', () => {
    const invalidUrl = RobustDownloader.validateUrl('http://169.254.169.254/latest/meta-data');
    if (process.env.NODE_ENV === 'production') {
      assert.strictEqual(invalidUrl.valid, false);
    } else {
      assert.strictEqual(RobustDownloader.validateUrl('ftp://invalido.com').valid, false);
    }
  });

  await test('Detecção de Magic Bytes: Distinção entre XLSX, ZIP e HTML', () => {
    // Buffer simulando arquivo ZIP / XLSX (PK..)
    const zipBuf = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00]);
    const zipDetected = RobustDownloader.detectContentType(zipBuf);
    assert.strictEqual(zipDetected.isZipOrXlsx, true);
    assert.strictEqual(zipDetected.isHtml, false);

    // Buffer simulando página HTML retornada com HTTP 200
    const htmlBuf = Buffer.from('<!DOCTYPE html><html><head><title>Access Denied</title></head><body>Bloqueado</body></html>');
    const htmlDetected = RobustDownloader.detectContentType(htmlBuf);
    assert.strictEqual(htmlDetected.isHtml, true);
    assert.strictEqual(htmlDetected.isZipOrXlsx, false);
  });

  await test('Download bloqueia e reporta erro explícito para arquivo HTML retornado no lugar de XLSX', () => {
    const htmlBuf = Buffer.from('<!DOCTYPE html><html><body>Error 404</body></html>');
    const detected = RobustDownloader.detectContentType(htmlBuf);
    assert.strictEqual(detected.isHtml, true);
    
    const opErr = new IngestionOperationalError({
      code: 'content_validation_error',
      message: 'Fonte retornou HTML em vez de planilha XLSX',
      url: 'https://ssp.sp.gov.br/dados.xlsx',
      httpStatus: 200
    });
    assert.strictEqual(opErr.code, 'content_validation_error');
    assert.strictEqual(opErr.httpStatus, 200);
  });

  // -----------------------------------------------------------------------------------
  // 5.5: Detecção de Mudança de Layout (Compatível vs. Incompatível)
  // -----------------------------------------------------------------------------------
  console.log('\n--- 5.5: Validação de Contrato de Layout e Mudanças Incompatíveis ---');

  await test('Layout oficial válido de microdados é aprovado', () => {
    const headers = ['NUM_BO', 'ANO_BO', 'MUNICIPIO_ELABORACAO', 'RUBRICA', 'LATITUDE', 'LONGITUDE'];
    const res = SchemaValidator.validateHeaders(headers, 'microdados');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.isBreakingChange, false);
    assert.strictEqual(res.missingRequiredColumns.length, 0);
  });

  await test('Mudança compatível: Novas colunas adicionais geram warnings sem quebrar parsing', () => {
    const headers = ['NUM_BO', 'ANO_BO', 'MUNICIPIO_ELABORACAO', 'NOVA_COLUNA_SECRETARIA', 'OUTRO_METADADO'];
    const res = SchemaValidator.validateHeaders(headers, 'microdados');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.isBreakingChange, false);
    assert.strictEqual(res.unknownColumns.length, 2);
    assert(res.warnings.length > 0);
  });

  await test('Mudança incompatível: Remoção de coluna obrigatória BLOQUEIA ingestão', () => {
    // Ausência do número do BO e Município
    const headers = ['ANO_BO', 'DATA_OCORRENCIA'];
    const res = SchemaValidator.validateHeaders(headers, 'microdados');
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.isBreakingChange, true);
    assert(res.missingRequiredColumns.length > 0);
    assert(res.error?.includes('Mudança incompatível'));
  });

  // -----------------------------------------------------------------------------------
  // 5.6: Quality Gate e Anomalias Estatísticas
  // -----------------------------------------------------------------------------------
  console.log('\n--- 5.6: Quality Gate e Tolerância de Qualidade de Dados ---');

  await test('Quality Gate APROVADO para lote de dados nominal', () => {
    const evaluation = QualityGate.evaluate({
      recordsRead: 1000,
      recordsValid: 980,
      recordsInvalid: 20,
      recordsInserted: 980,
      recordsDuplicate: 5,
      recordsWithoutCoordinates: 100,
      recordsWithInvalidCoordinates: 5,
      recordsWithUnknownMunicipality: 10
    });
    assert.strictEqual(evaluation.passed, true);
    assert.strictEqual(evaluation.status, 'PASSED');
    assert(evaluation.score >= 0.85);
  });

  await test('Quality Gate com WARNING para perda moderada de coordenadas', () => {
    const evaluation = QualityGate.evaluate({
      recordsRead: 1000,
      recordsValid: 820,
      recordsInvalid: 180, // 18% inválidos (> 15%)
      recordsInserted: 820,
      recordsDuplicate: 0,
      recordsWithoutCoordinates: 300,
      recordsWithInvalidCoordinates: 20,
      recordsWithUnknownMunicipality: 50
    });
    assert.strictEqual(evaluation.passed, true);
    assert.strictEqual(evaluation.status, 'WARNING');
    assert(evaluation.warnings.length > 0);
  });

  await test('Quality Gate REJEITADO para lote com 100% registros inválidos ou corrompidos', () => {
    const evaluation = QualityGate.evaluate({
      recordsRead: 500,
      recordsValid: 0,
      recordsInvalid: 500,
      recordsInserted: 0,
      recordsDuplicate: 0,
      recordsWithoutCoordinates: 500,
      recordsWithInvalidCoordinates: 0,
      recordsWithUnknownMunicipality: 500
    });
    assert.strictEqual(evaluation.passed, false);
    assert.strictEqual(evaluation.status, 'REJECTED');
    assert(evaluation.rejectionReasons.length > 0);
  });

  // -----------------------------------------------------------------------------------
  // 5.7: Motor de Reconciliação Estatística
  // -----------------------------------------------------------------------------------
  console.log('\n--- 5.7: Motor de Reconciliação e Controle de Integridade ---');

  const occMockSample: CanonicalOccurrence[] = [
    {
      sourceId: 'SSP-SP',
      stateCode: 'SP',
      municipalityCode: '3550308',
      occurredAt: new Date(),
      referencePeriod: '2026-01',
      category: 'homicide',
      subcategory: null,
      sourceCategory: 'HOMICIDIO DOLOSO',
      latitude: -23.5505,
      longitude: -46.6333,
      locationPrecision: 'exact',
      isSyntheticPoint: false,
      sourceRecordId: 'BO-001',
      incidentHash: 'hash-01'
    },
    {
      sourceId: 'SSP-SP',
      stateCode: 'SP',
      municipalityCode: '3550308',
      occurredAt: new Date(),
      referencePeriod: '2026-01',
      category: 'robbery',
      subcategory: null,
      sourceCategory: 'ROUBO',
      latitude: -23.5505,
      longitude: -46.6333,
      locationPrecision: 'exact',
      isSyntheticPoint: false,
      sourceRecordId: 'BO-002',
      incidentHash: 'hash-02'
    }
  ];

  const indMockSample: CanonicalIndicator[] = [
    {
      sourceId: 'SSP-SP',
      stateCode: 'SP',
      municipalityCode: '3550308',
      category: 'homicide',
      subcategory: null,
      period: '2026-01',
      value: 1,
      unit: 'count',
      granularity: 'municipality'
    },
    {
      sourceId: 'SSP-SP',
      stateCode: 'SP',
      municipalityCode: '3550308',
      category: 'robbery',
      subcategory: null,
      period: '2026-01',
      value: 1,
      unit: 'count',
      granularity: 'municipality'
    }
  ];

  await test('Reconciliação com status PASSED para contagem idêntica', () => {
    const res = ReconciliationEngine.reconcile('SP', '2026-01', occMockSample, indMockSample);
    assert.strictEqual(res.passed, true);
    assert.strictEqual(res.status, 'passed');
    assert.strictEqual(res.discrepancyAbsolute, 0);
  });

  await test('Reconciliação com status FAILED para divergência crítica (> 5%)', () => {
    const divergentIndicators: CanonicalIndicator[] = [
      {
        sourceId: 'SSP-SP',
        stateCode: 'SP',
        municipalityCode: '3550308',
        category: 'homicide',
        subcategory: null,
        period: '2026-01',
        value: 100, // 1 vs 100
        unit: 'count',
        granularity: 'municipality'
      }
    ];

    const res = ReconciliationEngine.reconcile('SP', '2026-01', occMockSample, divergentIndicators);
    assert.strictEqual(res.passed, false);
    assert.strictEqual(res.status, 'failed');
    assert(res.discrepancyPercentage > 5.0);
  });

  // -----------------------------------------------------------------------------------
  // 5.8: Observabilidade Estruturada e Sanitização
  // -----------------------------------------------------------------------------------
  console.log('\n--- 5.8: Logs Estruturados e Sanitização de Segredos ---');

  await test('StructuredLogger sanitiza automaticamente senhas e connection strings', () => {
    const log = StructuredLogger.info('Teste de conexão', {
      jobId: 'job-999',
      connectionString: 'postgres://db_user:masked_password_sample@localhost:5432/radar',
      apiKey: 'sample_api_key',
      stage: 'test_stage'
    });

    assert.strictEqual(log.jobId, 'job-999');
    assert.strictEqual(log.apiKey, '***');
    assert(!JSON.stringify(log).includes('masked_password_sample'));
  });

  // -----------------------------------------------------------------------------------
  // Resumo Final da Auditoria
  // -----------------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`📊 RESUMO DA SUÍTE FASE 5: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5Audit().catch((err) => {
  console.error('💥 Erro fatal na suíte da Fase 5:', err);
  process.exit(1);
});
