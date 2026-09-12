import { db } from '../src/db/index.js';
import { securityOccurrences, securityIndicators, dataImports } from '../src/db/schema.js';
import { SinespDownloader } from '../src/ingestion/downloaders/sinesp_downloader.js';
import { BaCrawler } from '../src/ingestion/pipeline/BaCrawler.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/IngestionWorker.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';

async function hardReset() {
  console.log('--- HARD RESET DB ---');
  await db.delete(securityOccurrences);
  await db.delete(securityIndicators);
  await db.delete(dataImports);
  if (fs.existsSync('./raw_storage')) fs.rmSync('./raw_storage', { recursive: true, force: true });
}

async function registerManualFixture(sourceId: string, stateCode: string, fixtureRelPath: string) {
  const fixturePath = path.join(process.cwd(), fixtureRelPath);
  const fileBuffer = fs.readFileSync(fixturePath);
  const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const size = fs.statSync(fixturePath).size;
  const fileName = path.basename(fixturePath);
  
  const rawStoragePath = path.join(process.cwd(), 'raw_storage', sourceId.toLowerCase(), 'e2e_audit', fileName);
  fs.mkdirSync(path.dirname(rawStoragePath), { recursive: true });
  fs.writeFileSync(rawStoragePath, fileBuffer);
  
  await JobManager.createJob({
    sourceId,
    datasetId: `${sourceId.toLowerCase()}_dataset`,
    rawFilePath: rawStoragePath,
    originalFilename: fileName,
    checksum,
    fileSize: size,
    stateCode,
    acquisitionMethod: 'MANUAL_UPLOAD',
    force: true,
    sourceType: 'fixture',
    environment: 'production',
    isOfficialPublication: false,
    isEligibleForProductionAutomation: false
  });
}

async function runValidations() {
  await hardReset();
  
  console.log('--- EXECUTANDO DOWNLOADERS (SINESP e SSP-BA) ---');
  try {
    const sinesp = new SinespDownloader();
    // Run sinesp but mock the sleep or limit to just 1 file to speed up
    await sinesp.run();
  } catch (e) {
    console.error('Sinesp erro:', e);
  }
  
  try {
    await new BaCrawler().run();
  } catch (e) {
    console.error('BA erro:', e);
  }
  
  console.log('--- REGISTRANDO FIXTURES (SP, RS, CE) ---');
  await registerManualFixture('SSP-SP', 'SP', 'tests/fixtures/ssp/ssp_sp_bo_real.csv');
  await registerManualFixture('SSP-RS', 'RS', 'tests/fixtures/ssp-rs/ssp_rs_municipios_wide_real.csv');
  await registerManualFixture('SSPDS-CE', 'CE', 'tests/fixtures/sspds-ce/sspds_ce_municipios_wide_real.csv');
  
  console.log('--- PROCESSANDO FILA DO WORKER ---');
  const worker = new IngestionWorker();
  let pending = true;
  while (pending) {
    const count = await db.select().from(dataImports).where(eq(dataImports.status, 'pending')).limit(1);
    if (count.length === 0) {
      pending = false;
      break;
    }
    await worker.processPendingJobs();
  }
  
  console.log('--- METRICAS DE E2E ---');
  const imports = await db.select().from(dataImports);
  const occs = await db.select({
    sourceId: securityOccurrences.sourceId,
    count: sql<number>`count(*)`
  }).from(securityOccurrences).groupBy(securityOccurrences.sourceId);
  
  const inds = await db.select({
    sourceId: securityIndicators.sourceId,
    count: sql<number>`count(*)`
  }).from(securityIndicators).groupBy(securityIndicators.sourceId);
  
  console.log('\n================ RESUMO E2E ===================');
  for (const imp of imports) {
    const occCount = occs.find(o => o.sourceId === imp.sourceId)?.count || 0;
    const indCount = inds.find(i => i.sourceId === imp.sourceId)?.count || 0;
    console.log(`Fonte: ${imp.sourceId} | Arquivo: ${imp.originalFilename} | Status: ${imp.status} | Processados: ${imp.recordsImported} | Occs: ${occCount} | Inds: ${indCount}`);
  }
  console.log('===============================================');
}
runValidations();
