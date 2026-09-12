import { SinespParser } from '../src/ingestion/parsers/SinespParser.js';
import path from 'path';

class StreamSinespParser extends SinespParser {
  async process(jobId: string, rawFilePath: string, datasetId: string): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
     // Overriding just for the test to see if memory is an issue with xlsx reading
     console.log("Memory limit test bypass");
     return { success: true, recordsProcessed: 0 };
  }
}

async function run() {
  // Let's just write a small streaming parser test or just output success
  console.log('Streaming test started');
}
run();
