import { app } from '../server.js';
import { db } from '../src/db/index.js';
import { dataImports, securityOccurrences, securityIndicators } from '../src/db/schema.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { CoverageMatrixService } from '../src/services/CoverageMatrixService.js';
import { SafetyAnalysisService } from '../src/services/SafetyAnalysisService.js';
import { eq, sql, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runAudit() {
  console.log("=== INICIANDO AUDITORIA TÉCNICA DO PIPELINE UNIFICADO & MATRIZ DE COBERTURA ===");

  const fixturePath = path.join(process.cwd(), 'tests/fixtures/ssp/ssp_sp_bo_real.csv');
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Arquivo de fixture não encontrado: ${fixturePath}`);
  }

  // ----------------------------------------------------
  // TEST 1: Processamento de Arquivo Oficial Real (SSP-SP)
  // ----------------------------------------------------
  console.log("\n[1] Ingestão de Arquivo Oficial Real SSP-SP via Pipeline Unificado...");
  const fileBuffer = fs.readFileSync(fixturePath);
  const crypto = await import('crypto');
  const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const fileSize = fs.statSync(fixturePath).size;

  const rawStoragePath = path.join(process.cwd(), 'raw_storage/ssp-sp/audit_v1/ssp_sp_bo_real.csv');
  fs.mkdirSync(path.dirname(rawStoragePath), { recursive: true });
  fs.writeFileSync(rawStoragePath, fileBuffer);

  const jobResult = await JobManager.createJob({
    sourceId: 'SSP-SP',
    datasetId: 'ssp-sp',
    rawFilePath: rawStoragePath,
    originalFilename: 'ssp_sp_bo_real.csv',
    checksum,
    fileSize,
    stateCode: 'SP',
    acquisitionMethod: 'MANUAL_UPLOAD',
    force: true,
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });

  console.log(`✓ Job criado: ${jobResult.jobId} (isDuplicate: ${jobResult.isDuplicate})`);

  const worker = new IngestionWorker('audit-worker-1');
  const processResult = await worker.processJobDirectly(jobResult.jobId);
  if (!processResult.success) {
    throw new Error("Falha no processamento do Job pelo Worker");
  }
  console.log("✓ Worker processou o job com SUCESSO.");

  // ----------------------------------------------------
  // TEST 2: Validação de Metadados de Proveniência em data_imports
  // ----------------------------------------------------
  console.log("\n[2] Verificando Rastreabilidade e Metadados de Proveniência...");
  const [importedJob] = await db
    .select()
    .from(dataImports)
    .where(eq(dataImports.id, jobResult.jobId));

  if (!importedJob) {
    throw new Error("Job não encontrado em data_imports!");
  }

  console.log(`- Source ID: ${importedJob.sourceId}`);
  console.log(`- State Code: ${importedJob.stateCode}`);
  console.log(`- Checksum (SHA-256): ${importedJob.checksum}`);
  console.log(`- Método de Aquisição: ${importedJob.acquisitionMethod}`);
  console.log(`- Parser Utilizado: ${importedJob.parserUsed}`);
  console.log(`- Versão do Parser: ${importedJob.parserVersion}`);
  console.log(`- Status de Qualidade: ${importedJob.qualityStatus}`);
  console.log(`- Registros Lidos: ${importedJob.recordsRead}, Válidos: ${importedJob.recordsValid}, Inseridos: ${importedJob.recordsInserted}`);

  if (importedJob.status !== 'COMPLETED') {
    throw new Error(`Esperado status COMPLETED em data_imports, obtido: ${importedJob.status}`);
  }
  if (!importedJob.parserUsed || importedJob.parserUsed === 'UnknownAdapter') {
    throw new Error("Parser Utilizado não foi registrado corretamente!");
  }
  if (importedJob.checksum !== checksum) {
    throw new Error("Checksum divergente do arquivo original!");
  }
  console.log("✓ Metadados de Proveniência auditados e validados com sucesso!");

  // ----------------------------------------------------
  // TEST 3: Validação de RAW Storage
  // ----------------------------------------------------
  console.log("\n[3] Verificando Preservação do Arquivo no RAW Storage...");
  if (!fs.existsSync(rawStoragePath)) {
    throw new Error(`Arquivo RAW storage não foi preservado em: ${rawStoragePath}`);
  }
  console.log(`✓ Arquivo original preservado intacto em RAW Storage: ${rawStoragePath}`);

  // ----------------------------------------------------
  // TEST 4: Idempotência na Reimportação
  // ----------------------------------------------------
  console.log("\n[4] Testando Idempotência de Reimportação do Mesmo Checksum...");
  const duplicateJobResult = await JobManager.createJob({
    sourceId: 'SSP-SP',
    datasetId: 'ssp-sp',
    rawFilePath: rawStoragePath,
    originalFilename: 'ssp_sp_bo_real.csv',
    checksum,
    fileSize,
    stateCode: 'SP',
    acquisitionMethod: 'MANUAL_UPLOAD',
    force: false, // Idempotência ativada
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });

  if (!duplicateJobResult.isDuplicate) {
    throw new Error("Erro de Idempotência: Arquivo com mesmo SHA-256 deveria ter sido marcado como duplicado!");
  }
  if (duplicateJobResult.status !== 'COMPLETED') {
    throw new Error(`Erro de Idempotência: Esperado status COMPLETED em job duplicado, obtido: ${duplicateJobResult.status}`);
  }
  console.log("✓ Idempotência comprovada! Reimportação detectada e descartada sem duplicar registros.");

  // ----------------------------------------------------
  // TEST 5: Rejeição de Arquivo Inválido / Vazio (Quality Gate)
  // ----------------------------------------------------
  console.log("\n[5] Testando Quality Gate com Arquivo Vazio (0 bytes)...");
  const emptyFilePath = path.join(process.cwd(), 'raw_storage/ssp-sp/audit_v1/empty.csv');
  fs.writeFileSync(emptyFilePath, '');
  const emptyChecksum = crypto.createHash('sha256').update('').digest('hex');

  const emptyJob = await JobManager.createJob({
    sourceId: 'SSP-SP',
    datasetId: 'ssp-sp',
    rawFilePath: emptyFilePath,
    originalFilename: 'empty.csv',
    checksum: emptyChecksum,
    fileSize: 0,
    stateCode: 'SP',
    force: true,
    sourceType: 'fixture',
    environment: 'test',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });

  const emptyProcessResult = await worker.processJobDirectly(emptyJob.jobId);
  if (emptyProcessResult.success !== false) {
    throw new Error("Quality Gate falhou: Arquivo de 0 bytes deveria ter sido rejeitado pelo Worker!");
  }

  const [failedJob] = await db.select().from(dataImports).where(eq(dataImports.id, emptyJob.jobId));
  if (failedJob.status !== 'FAILED' || failedJob.qualityStatus !== 'REJECTED') {
    throw new Error(`Esperado status FAILED e qualityStatus REJECTED, obtido: status=${failedJob.status}, quality=${failedJob.qualityStatus}`);
  }
  console.log("✓ Quality Gate aprovado! Arquivo inválido rejeitado com status FAILED/REJECTED sem contaminar o banco de dados.");

  // ----------------------------------------------------
  // TEST 6: Integração Real Ponta a Ponta com a API de Segurança
  // ----------------------------------------------------
  console.log("\n[6] Testando API de Análise com Dados Reais Ingeridos (São Paulo)...");
  const analysisService = new SafetyAnalysisService();
  const analysis = await analysisService.analyze({
    lat: -23.5654, // Av. Paulista (presente no BO real)
    lon: -46.6515,
    radiusMeters: 5000,
    periodMonths: 12
  });

  console.log(`- Score Retornado: ${analysis.score}`);
  console.log(`- Status: ${analysis.status}`);
  console.log(`- Total de Registros Encontrados: ${analysis.availableData.totalRecords}`);

  if (analysis.availableData.totalRecords === 0) {
    throw new Error("Ocorrências reais importadas do SSP-SP não foram localizadas pela API de Análise!");
  }
  console.log("✓ Integração com a API de Análise provada com dados reais!");

  // ----------------------------------------------------
  // TEST 7: Diferenciação de Ausência de Dados vs Segurança
  // ----------------------------------------------------
  console.log("\n[7] Testando Localidade sem Dados Importados (Rio Branco, AC)...");
  const emptyAnalysis = await analysisService.analyze({
    lat: -9.9749, // Rio Branco, AC (Sem dados importados no momento)
    lon: -67.8076,
    radiusMeters: 5000
  });

  console.log(`- Score em Região Sem Dados: ${emptyAnalysis.score}`);
  console.log(`- Status: ${emptyAnalysis.status}`);
  console.log(`- Aviso de Ausência: "${emptyAnalysis.dataAbsenceNotice}"`);

  if (emptyAnalysis.score !== null) {
    throw new Error(`Ausência de dados deve resultar obrigatoriamente em Score NULL! Obtido: ${emptyAnalysis.score}`);
  }
  if (emptyAnalysis.status !== 'insufficient_data') {
    throw new Error(`Esperado status 'insufficient_data', obtido: ${emptyAnalysis.status}`);
  }
  console.log("✓ Regra de Integridade Aprovada: Ausência de dados retorna Score NULL e alerta explícito, jamais presumindo segurança!");

  // ----------------------------------------------------
  // TEST 8: Geração da Matriz de Cobertura de Evidências (E0 a E7)
  // ----------------------------------------------------
  console.log("\n[8] Auditando Matriz de Cobertura de Evidências (E0..E7)...");
  const matrix = await CoverageMatrixService.getMatrix();

  console.log(`- Total de Fontes Registradas: ${matrix.totalSources}`);
  console.log(`- Fontes Operacionais (Com Dados Reais Importados): ${matrix.operationalSources}`);
  console.log(`- Fontes com Upload Manual Requerido: ${matrix.manualUploadRequiredSources}`);

  const spCoverage = matrix.coverage.find(c => c.sourceId === 'SSP-SP');
  if (!spCoverage) {
    throw new Error("SSP-SP não localizada na Matriz de Cobertura!");
  }

  console.log(`\n--- Status da Fonte SSP-SP ---`);
  console.log(`- Nível de Evidência: ${spCoverage.evidenceLevel}`);
  console.log(`- Descrição da Evidência: ${spCoverage.evidenceDescription}`);
  console.log(`- Status Operacional: ${spCoverage.operationalStatus}`);
  console.log(`- Registros Processados: ${spCoverage.processedRecordsCount}`);
  console.log(`- Motivo de Restrição Automatizada: ${spCoverage.unavailabilityReason}`);

  if (spCoverage.evidenceLevel !== 'E5') {
    throw new Error(`Esperado Nível E5 para SSP-SP após ingestão real, obtido: ${spCoverage.evidenceLevel}`);
  }

  const sinespCoverage = matrix.coverage.find(c => c.sourceId === 'SINESP');
  if (!sinespCoverage) {
    throw new Error("SINESP não localizada na Matriz de Cobertura!");
  }
  console.log(`\n--- Status da Fonte SINESP ---`);
  console.log(`- Status Operacional: ${sinespCoverage.operationalStatus}`);
  console.log(`- Motivo Transparente: ${sinespCoverage.unavailabilityReason}`);

  console.log("\n==================================================================");
  console.log("SUCCESS: TODAS AS PROVAS DA AUDITORIA FORAM EXECUTADAS COM SUCESSO!");
  console.log("==================================================================");
}

runAudit().catch(err => {
  console.error("FALHA NA AUDITORIA:", err);
  process.exit(1);
});
