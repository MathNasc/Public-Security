import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter.js';
import crypto from 'crypto';

export class SspdsCeAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Estatísticas Criminais SSPDS-CE",
      agency: "Secretaria da Segurança Pública e Defesa Social do Ceará",
      frequency: "Mensal",
      coverage: "CE",
      limitations: ["Registros baseados em CVLI, CVP e apreensões."]
    };
  }

  identifyVersion(): string { return "1.0.0"; }

  async discover(): Promise<DiscoveryResult> {
    const currentYear = new Date().getFullYear();
    return {
      source: "SSPDS-CE",
      dataset: "Indicadores_CE",
      url: `https://www.sspds.ce.gov.br/dados/${currentYear}.csv`,
      version: `${currentYear}-latest`,
      checksum: crypto.randomBytes(16).toString('hex')
    };
  }

  async download(destinationPath: string): Promise<string> { return destinationPath; }

  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    const records: ParsedRecord[] = [];
    const municipio = row['Municipio'] || row['Município'] || '';
    const natureza = row['Natureza'] || row['Indicador'] || '';
    const total = parseInt(row['Total'] || '0', 10);
    
    if (!municipio || isNaN(total) || total === 0) return null;

    const crimeMapping: Record<string, string> = {
      'CVLI': 'homicidio', 'CVP': 'roubo', 'FURTO': 'furto', 'ESTUPRO': 'estupro'
    };
    const normNat = natureza.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const cat = crimeMapping[normNat] || 'outros';
    
    const ano = row['Ano'] || new Date().getFullYear();
    const mes = String(row['Mes'] || '01').padStart(2, '0');
    
    records.push({
      target: 'indicators',
      data: { id: crypto.randomUUID(), sourceId: 'SSPDS-CE', stateCode: 'CE', municipalityName: municipio, category: cat, sourceCategory: natureza, period: `${ano}-${mes}`, value: total, unit: 'ocorrencias' }
    });
    return records;
  }
}
