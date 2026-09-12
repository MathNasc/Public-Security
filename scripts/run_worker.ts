import { IngestionWorker } from '../src/ingestion/pipeline/IngestionWorker.js';
import { db } from '../src/db/index.js';
import { dataImports } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function run() {
  const worker = new IngestionWorker();
  let pending = true;
  while (pending) {
    const pendingCount = await db.select().from(dataImports).where(eq(dataImports.status, 'pending')).limit(1);
    if (pendingCount.length === 0) {
      console.log('Sem mais jobs pendentes. Finalizando.');
      break;
    }
    try {
      await worker.processPendingJobs();
    } catch (e) {
      console.error('Erro no worker:', e);
      break;
    }
  }
}
run();
