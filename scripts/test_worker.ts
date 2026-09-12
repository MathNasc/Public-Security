import { IngestionWorker } from '../src/ingestion/pipeline/IngestionWorker.js';

async function run() {
  const worker = new IngestionWorker();
  await worker.processPendingJobs();
}
run();
