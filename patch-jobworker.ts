import fs from 'fs';
let code = fs.readFileSync('src/ingestion/orchestration/JobWorker.ts', 'utf8');

code = code.replace(/job\.id/g, '(job.id as string)');
code = code.replace(/job\.retryCount/g, '(job.retry_count as number)');
code = code.replace(/job\.maxRetries/g, '(job.max_retries as number)');

fs.writeFileSync('src/ingestion/orchestration/JobWorker.ts', code);
