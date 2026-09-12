import { BaseParser } from './BaseParser.js';
import { db } from '../../db/index.js';
import { securityOccurrences } from '../../db/schema.js';

export class CeParser extends BaseParser {
  protected getExpectedHeaders(): string[] { return []; }
  
  protected async parseRow(row: any): Promise<any> {
    // Esse parser será refinado assim que o usuário fizer o primeiro upload
    // contendo o formato real das planilhas do Ceará
    return null;
  }

  async process(jobId: string, rawFilePath: string, datasetId: string): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
     // AWAITING CEARA SAMPLE FROM USER UPLOAD
     console.log(`[CeParser] Parser do Ceará ainda não mapeado. Aguardando a primeira planilha para estruturação. Arquivo: ${rawFilePath}`);
     return { success: false, recordsProcessed: 0, error: 'Layout de colunas do Ceará ainda não mapeado.' };
  }
}
