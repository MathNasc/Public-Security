import { createSspCsvStream } from './parser.js';
import { normalizeSspRecord, RawCrimeRecord } from './normalizer.js';
import { DataIngestionService } from '../../services/DataIngestionService.js';
import crypto from 'crypto';
import * as path from 'path';

export async function importSspFile(filePath: string) {
  try {
    console.log(`[SSP INGESTION] Starting streaming processing for file: ${filePath}`);
    
    const fileName = path.basename(filePath);
    const sourceName = `SSP-SP (${fileName})`;
    const sourceInfo = {
      provider: "Secretaria de Segurança Pública - SP",
      description: `Importação oficial do arquivo ${fileName}`,
      url: "http://www.ssp.sp.gov.br/transparenciassp/",
      coverage: "Estado de São Paulo",
      filename: fileName,
      batchId: crypto.randomUUID()
    };
    
    let chunk: RawCrimeRecord[] = [];
    const CHUNK_SIZE = 1000;
    
    let totalRecords = 0;
    let totalImported = 0;
    
    const stream = createSspCsvStream(filePath);
    
    for await (const rawRecord of stream) {
      const normalized = normalizeSspRecord(rawRecord);
      if (normalized) {
        chunk.push(normalized);
        totalRecords++;
      }
      
      if (chunk.length >= CHUNK_SIZE) {
        const result = await DataIngestionService.ingestData(sourceName, chunk, sourceInfo);
        totalImported += result.inserted;
        chunk = []; // reset chunk
        console.log(`[SSP INGESTION] Progress: ${totalImported} records imported...`);
      }
    }
    
    // final chunk
    if (chunk.length > 0) {
      const result = await DataIngestionService.ingestData(sourceName, chunk, sourceInfo);
      totalImported += result.inserted;
      console.log(`[SSP INGESTION] Progress: ${totalImported} records imported...`);
    }

    console.log(`[SSP INGESTION] Successfully processed stream. Inserted ${totalImported} total records.`);
    
    return { 
       success: true, 
       inserted: totalImported,
    };

  } catch (error) {
    console.error(`[SSP INGESTION] Error processing file:`, error);
    throw error;
  }
}
