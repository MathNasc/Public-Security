import { BaseParser } from './BaseParser.js';
import { db } from '../../db/index.js';
import { securityOccurrences } from '../../db/schema.js';
import xlsx from 'xlsx';
import crypto from 'crypto';
import fs from 'fs';

export class SinespParser extends BaseParser {
  protected getExpectedHeaders(): string[] {
    // We do not enforce strict header match for Excel via text, we will validate inside process
    return []; 
  }

  protected async parseRow(row: any): Promise<any> {
    // Handled in bulk in process method
    return null;
  }

  async process(jobId: string, rawFilePath: string, datasetId: string): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
    try {
      console.log(`[SinespParser] Lendo arquivo Excel: ${rawFilePath}`);
      // Read entire workbook
      const workbook = xlsx.readFile(rawFilePath, { type: 'file', cellDates: true });
      
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("Excel file is empty");
      
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet) as any[];
      
      console.log(`[SinespParser] Encontradas ${rows.length} linhas na planilha ${sheetName}`);
      
      let recordsProcessed = 0;
      let batch = [];
      
      for (const row of rows) {
        // Map columns based on typical SINESP format:
        // UF, Tipo Crime, Mês, Ano, Vítimas
        // Note: Field names might vary, so we map them robustly
        
        const uf = row['UF'] || row['Sigla UF'] || row['Estado'] || 'BR';
        const crimeRaw = row['Tipo Crime'] || row['Crime'] || row['Natureza'] || 'Outros';
        const mesStr = (row['Mês'] || row['Mes'] || 'janeiro').toString().toLowerCase();
        const ano = parseInt(row['Ano'] || new Date().getFullYear().toString());
        const vitimas = parseInt(row['Vítimas'] || row['Ocorrências'] || '0') || 0;
        
        // Month to date
        const meses = { 'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5, 
                        'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11 };
        
        const monthNum = meses[mesStr] !== undefined ? meses[mesStr] : 0;
        const recordDate = new Date(ano, monthNum, 1);
        
        // Skip rows with 0 victims/occurrences if you want, but storing 0 is also fine.
        
        const recordId = crypto.randomUUID();
        batch.push({
          id: recordId,
          sourceId: 'SINESP',
          datasetId,
          stateCode: uf.toUpperCase().substring(0,2),
          municipalityName: null,
          category: this.mapCategory(crimeRaw),
          sourceCategory: crimeRaw,
          occurredAt: recordDate,
          year: ano,
          month: monthNum + 1, // Store as 1-12
          latitude: null,
          longitude: null,
          isSyntheticPoint: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        if (batch.length >= 500) {
          await db.insert(securityOccurrences).values(batch);
          recordsProcessed += batch.length;
          batch = [];
        }
      }
      
      if (batch.length > 0) {
        await db.insert(securityOccurrences).values(batch);
        recordsProcessed += batch.length;
      }
      
      console.log(`[SinespParser] Concluído. ${recordsProcessed} registros inseridos.`);
      return { success: true, recordsProcessed };
    } catch (e) {
      console.error(`[SinespParser] Falha:`, e);
      return { success: false, recordsProcessed: 0, error: e.message };
    }
  }

  private mapCategory(raw: string): string {
    const r = raw.toLowerCase();
    if (r.includes('homicídio') || r.includes('latrocínio') || r.includes('lesão corporal seguida de morte')) return 'cvli';
    if (r.includes('roubo') || r.includes('furto')) return 'cvp';
    if (r.includes('estupro')) return 'violencia_mulher';
    return 'other';
  }
}
