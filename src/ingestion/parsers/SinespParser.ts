import { BaseParser } from './BaseParser.js';
import { db } from '../../db/index.js';
import { securityIndicators } from '../../db/schema.js';
import xlsx from 'xlsx';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import path from 'path';

export class SinespParser extends BaseParser {
  protected getExpectedHeaders(): string[] { return []; }
  protected async parseRow(row: any): Promise<any> { return null; }
  
  async process(jobId: string, rawFilePath: string, datasetId: string): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
    try {
      console.log(`[SinespParser] Processando arquivo SINESP: ${rawFilePath}`);
      
      if (rawFilePath.toLowerCase().endsWith('.xlsx') || rawFilePath.toLowerCase().endsWith('.xls')) {
        const pythonScript = path.join(process.cwd(), 'src/ingestion/parsers/sinesp_stream_parser.py');
        const dbPath = path.join(process.cwd(), 'data/local_radar.db');
        
        console.log(`[SinespParser] Executando streaming parser de alto desempenho para SINESP XLSX...`);
        const output = execFileSync('python3', [pythonScript, rawFilePath, datasetId, dbPath], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        const res = JSON.parse(output.trim());
        if (!res.success) {
          throw new Error(res.error || 'Erro no parser de streaming');
        }
        console.log(`[SinespParser] Concluído com sucesso via stream parser: ${res.recordsProcessed} registros inseridos.`);
        return { success: true, recordsProcessed: res.recordsProcessed };
      }
      
      const workbook = xlsx.readFile(rawFilePath, { type: 'file', cellDates: true });
      
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("Excel file is empty");
      
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet) as any[];
      
      let recordsProcessed = 0;
      let batch = [];
      
      for (const row of rows) {
        const uf = (row['UF'] || row['Sigla UF'] || row['uf'])?.toString();
        if (!uf) continue;
        
        const crimeRaw = (row['Tipo Crime'] || row['Natureza'] || row['Crime'] || row['evento'])?.toString();
        if (!crimeRaw) continue;
        
        let mesStr = (row['Mês'] || row['Mes'] || 'janeiro').toString().toLowerCase();
        let ano = parseInt(row['Ano'] || new Date().getFullYear().toString());
        
        const dataRef = row['data_referencia'];
        if (dataRef) {
           let dt;
           if (dataRef instanceof Date) dt = dataRef;
           else if (typeof dataRef === 'number') {
              dt = new Date((dataRef - 25569) * 86400 * 1000); 
           } else {
              dt = new Date(dataRef.toString());
           }
           if (!isNaN(dt.getTime())) {
              ano = dt.getFullYear();
              const mesesMap = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
              mesStr = mesesMap[dt.getMonth()];
           }
        }
        
        const vitimas = parseInt(row['Vítimas'] || row['Ocorrências'] || row['total_vitima'] || '0') || 0;
        
        const meses: Record<string, number> = { 'janeiro': 1, 'fevereiro': 2, 'março': 3, 'abril': 4, 'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12 };
        const monthNum = meses[mesStr] || 1;
        
        const periodStr = `${ano}-${String(monthNum).padStart(2, '0')}`;
        
        if (vitimas > 0) {
          batch.push({
            id: crypto.randomUUID(),
            sourceId: 'SINESP',
            datasetId,
            stateCode: uf.toUpperCase().substring(0,2),
            category: this.mapCategory(crimeRaw),
            sourceCategory: crimeRaw,
            subcategory: crimeRaw,
            period: periodStr,
            value: vitimas,
            unit: 'occurrences',
            granularity: 'state',
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        
        if (batch.length >= 10) {
          await db.insert(securityIndicators).values(batch).onConflictDoNothing();
          recordsProcessed += batch.length;
          batch = [];
        }
      }
      
      if (batch.length > 0) {
        await db.insert(securityIndicators).values(batch).onConflictDoNothing();
        recordsProcessed += batch.length;
      }
      
      console.log(`[SinespParser] Concluído. ${recordsProcessed} indicadores inseridos.`);
      return { success: true, recordsProcessed };
    } catch (e: any) {
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
