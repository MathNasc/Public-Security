import { SspSpAdapter } from '../src/ingestion/adapters/ssp/SspSpAdapter.js';
import { PipelineAutomationService } from '../src/ingestion/orchestration/PipelineAutomationService.js';
import { db } from '../src/db/index.js';
import { dataImports, securityIndicators, dataSources } from '../src/db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runLiveSspSpAutomationE2E() {
  console.log("================================================================================");
  console.log("    VALIDAÇÃO E2E DA AQUISIÇÃO REAL, AUTOMATIZADA E REPRODUZÍVEL DA SSP-SP      ");
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

  // 1. Instanciação e Descoberta Automatizada Online
  console.log("\n--- ETAPA 1: DISCOVERY ONLINE OFICIAL NA SSP-SP ---");
  const adapter = new SspSpAdapter();
  const discovery = await adapter.discover();
  
  assert(!!discovery.url, "1.1 URL oficial de exportação gerada dinamicamente");
  assert(discovery.url.includes("https://www.ssp.sp.gov.br/v1/OcorrenciasMensais/ExportarMensal"), "1.2 Endpoint oficial correto da SSP-SP");
  assert(/^\d{4}-\d{2}$/.test(discovery.version), `1.3 Versão oficial detectada dinamicamente: ${discovery.version}`);
  console.log(`   URL: ${discovery.url}`);
  console.log(`   Versão: ${discovery.version}`);

  // 2. Download Automatizado Real do Arquivo Oficial
  console.log("\n--- ETAPA 2: DOWNLOAD AUTOMATIZADO REAL (SEM FIXTURE) ---");
  const tempDownloadPath = path.join(process.cwd(), 'data/temp/test_ssp_sp_live.csv');
  const tempXlsxPath = path.join(process.cwd(), 'data/temp/test_ssp_sp_live.xlsx');
  
  if (fs.existsSync(tempDownloadPath)) fs.unlinkSync(tempDownloadPath);
  if (fs.existsSync(tempXlsxPath)) fs.unlinkSync(tempXlsxPath);

  const downloadedCsv = await adapter.download(tempDownloadPath);
  assert(fs.existsSync(downloadedCsv), "2.1 Arquivo CSV derivado gerado no disco");
  assert(fs.existsSync(tempXlsxPath), "2.2 Arquivo binário XLSX oficial bruto preservado no disco");
  
  const xlsxStats = fs.statSync(tempXlsxPath);
  const csvStats = fs.statSync(tempDownloadPath);
  assert(xlsxStats.size > 1000, `2.3 Planilha XLSX oficial baixada com sucesso (${xlsxStats.size} bytes)`);
  assert(csvStats.size > 500, `2.4 Tabela CSV derivada com dados válidos (${csvStats.size} bytes)`);

  // 3. Execução do Ciclo de Automação de Ponta a Ponta via PipelineAutomationService
  console.log("\n--- ETAPA 3: EXECUÇÃO DO PIPELINE COMPLETO VIA PIPELINE AUTOMATION SERVICE ---");
  const cycleResult = await PipelineAutomationService.runAutomationCycle({ force: true });
  
  assert(cycleResult.success, "3.1 Ciclo de automação concluído com sucesso");
  assert(!!cycleResult.jobId, `3.2 Job de importação criado e executado: ${cycleResult.jobId}`);
  assert(cycleResult.metrics?.recordsInserted > 0, `3.3 Registros inseridos no banco: ${cycleResult.metrics?.recordsInserted}`);

  // 4. Verificação no Banco de Dados: Job em data_imports
  console.log("\n--- ETAPA 4: VERIFICAÇÃO DE PROVENIÊNCIA E METADADOS DO JOB ---");
  const [job] = await db.select().from(dataImports).where(eq(dataImports.id, cycleResult.jobId!));
  assert(!!job, "4.1 Registro de importação encontrado em data_imports");
  assert(job.sourceId === 'SSP-SP', "4.2 Fonte identificada como SSP-SP");
  assert(job.status === 'COMPLETED', `4.3 Status do Job é COMPLETED (atual: ${job.status})`);
  assert(job.acquisitionMethod === 'AUTOMATED_DOWNLOAD', `4.4 Método de aquisição registrado: ${job.acquisitionMethod}`);
  assert(job.sourceType === 'official_download', `4.5 Tipo de fonte: ${job.sourceType}`);
  assert(Boolean(job.isOfficialPublication), "4.6 Marcado como publicação oficial real");
  assert(!!job.originUrl && job.originUrl.includes('ssp.sp.gov.br'), `4.7 URL de origem oficial auditável: ${job.originUrl}`);
  assert(!!job.checksum && job.checksum.length === 64, `4.8 Checksum SHA-256 gerado: ${job.checksum}`);
  assert(fs.existsSync(job.rawFilePath), `4.9 Arquivo RAW persistido e existente no storage: ${job.rawFilePath}`);

  // 5. Verificação de Persistência dos Indicadores Oficiais de SP
  console.log("\n--- ETAPA 5: VERIFICAÇÃO DOS DADOS PERSISTIDOS NO BANCO ---");
  const indicators = await db
    .select()
    .from(securityIndicators)
    .where(and(
      eq(securityIndicators.sourceId, 'SSP-SP'),
      eq(securityIndicators.stateCode, 'SP')
    ));

  assert(indicators.length > 0, `5.1 Indicadores oficiais de SP persistidos no banco (${indicators.length} registros)`);
  
  const homicidios = indicators.filter(i => i.category === 'homicide');
  assert(homicidios.length > 0, `5.2 Homicídios oficiais de SP categorizados (${homicidios.length} registros mensais)`);
  
  const veiculos = indicators.filter(i => i.category === 'vehicle_robbery' || i.category === 'vehicle_theft');
  assert(veiculos.length > 0, `5.3 Crimes patrimoniais de veículos de SP categorizados (${veiculos.length} registros)`);

  const sampleInd = indicators[0];
  console.log(`   Amostra de Indicador Ingerido:`);
  console.log(`   - Código Município/IBGE: ${sampleInd.municipalityCode}`);
  console.log(`   - Categoria Canônica: ${sampleInd.category} (Original: ${sampleInd.sourceCategory})`);
  console.log(`   - Período: ${sampleInd.period} | Valor: ${sampleInd.value} ${sampleInd.unit}`);

  // 6. Verificação do Status Operacional da Fonte
  console.log("\n--- ETAPA 6: VERIFICAÇÃO DO STATUS OPERACIONAL DA FONTE ---");
  const [source] = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-sp'`);
  assert(source.status === 'OPERATIONAL', `6.1 Status da fonte atualizado para OPERATIONAL (atual: ${source.status})`);
  assert(!!source.lastSuccessfulImport, `6.2 Timestamp de sucesso registrado: ${source.lastSuccessfulImport}`);

  console.log("\n================================================================================");
  console.log(`TOTAL DE TESTES E2E: ${passed + failed} | APROVADOS: ${passed} | FALHAS: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runLiveSspSpAutomationE2E().catch(err => {
  console.error("Erro fatal no teste E2E:", err);
  process.exit(1);
});
