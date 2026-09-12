import { SinespParser } from '../src/ingestion/parsers/SinespParser.js';
import path from 'path';

async function run() {
  const parser = new SinespParser();
  // Using the actual file downloaded by SINESP Downloader
  const filePath = path.join(process.cwd(), 'raw_storage/SINESP/v1/bancovde-2026.xlsx');
  
  console.log(`Starting parsing process for ${filePath}`);
  const result = await parser.process('test-job-id', filePath, 'sinesp-vde');
  console.log('Result:', result);
}
run();
