import { db } from '../src/db/index.js';
import { dataImports } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { IngestionWorker } from '../src/ingestion/pipeline/IngestionWorker.js';

async function run() {
  await db.update(dataImports)
    .set({ status: 'pending' })
    .where(eq(dataImports.sourceId, 'ISP-RJ'));
  console.log('Reset ISP-RJ jobs to pending.');
  
  const worker = new IngestionWorker();
  await worker.processPendingJobs(); // process 1st job
  await worker.processPendingJobs(); // process 2nd job
}
run();
