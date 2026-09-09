import { db } from './src/db/index.js';
import { createSspCsvStream } from './src/ingestion/ssp/parser.js';
import { normalizeSspRecord } from './src/ingestion/ssp/normalizer.js';
import { DataIngestionService } from './src/services/DataIngestionService.js';
import path from 'path';

async function main() {
  const filePath = "/tmp/sample_1788974033358.csv";
  const stream = createSspCsvStream(filePath);
  let chunk = [];
  
  for await (const raw of stream) {
    const norm = normalizeSspRecord(raw);
    if (norm) chunk.push(norm);
    if (chunk.length >= 50) break;
  }
  
  try {
    await DataIngestionService.ingestData("SSP-SP", chunk, { provider: "test", description: "test", url: "test", coverage: "test" });
    console.log("Success");
  } catch (e: any) {
    if (e.cause) {
      console.error("Cause:", e.cause);
    } else {
      console.error("Error:", e.message.substring(0, 500));
    }
  }
  process.exit(0);
}
main();
