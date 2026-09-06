import { parseSspCsv } from './parser.js';
import { normalizeSspRecord } from './normalizer.js';
import { DataIngestionService } from '../../services/DataIngestionService.js';
import * as path from 'path';

export async function importSspFile(filePath: string) {
  try {
    console.log(`[SSP INGESTION] Starting processing for file: ${filePath}`);
    
    // 1. Parse CSV
    const rawRecords = await parseSspCsv(filePath);
    console.log(`[SSP INGESTION] Parsed ${rawRecords.length} raw records from CSV.`);
    
    // 2. Normalize
    const normalizedRecords = rawRecords.map(normalizeSspRecord);

    console.log(`[SSP INGESTION] Normalized ${normalizedRecords.length} records.`);
    
    if (normalizedRecords.length === 0) {
      console.log(`[SSP INGESTION] No valid records found to import.`);
      return { success: false, message: 'No valid records found.' };
    }

    // 3. Import to DB
    const fileName = path.basename(filePath);
    const sourceName = `SSP-SP (${fileName})`;
    
    const result = await DataIngestionService.ingestData(sourceName, normalizedRecords, {
      provider: "Secretaria de Segurança Pública - SP",
      description: `Importação oficial do arquivo ${fileName}`,
      url: "http://www.ssp.sp.gov.br/transparenciassp/",
      coverage: "Estado de São Paulo",
      filename: fileName
    });
    
    console.log(`[SSP INGESTION] Successfully processed. Inserted ${result.stats.valid_records} valid records.`);
    
    return { 
      success: true, 
      inserted: result.stats.valid_records,
      stats: result.stats,
      batchId: result.batchId
    };
  } catch (error) {
    console.error(`[SSP INGESTION] Error processing file:`, error);
    throw error;
  }
}
