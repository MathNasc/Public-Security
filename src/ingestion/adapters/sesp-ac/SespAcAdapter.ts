import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter.js';
import crypto from 'crypto';

export class SespAcAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Estatísticas Criminais SESP-AC",
      agency: "Secretaria de Segurança Pública (AC)",
      frequency: "Mensal",
      coverage: "AC",
      limitations: []
    };
  }

  identifyVersion(): string { return "1.0.0"; }

  async discover(): Promise<DiscoveryResult> {
    const currentYear = new Date().getFullYear();
    return {
      source: "SESP-AC",
      dataset: "Indicadores_Criminais_AC",
      url: `https://www.seguranca.ac.gov.br/dados/${currentYear}.csv`,
      version: `${currentYear}-latest`,
      checksum: crypto.randomBytes(16).toString('hex')
    };
  }

  async download(destinationPath: string): Promise<string> { return destinationPath; }

  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    const records: ParsedRecord[] = [];
    const municipio = row['Municipio'] || row['Município'] || row['Cidade'] || '';
    const natureza = row['Natureza'] || row['Crime'] || row['Delito'] || '';
    const total = parseInt(row['Total'] || row['Ocorrencias'] || row['Quantidade'] || '0', 10);
    
    if (!municipio || isNaN(total) || total === 0) return null;

    const crimeMapping: Record<string, string> = {
      'HOMICIDIO': 'homicidio', 'LATROCINIO': 'latrocinio', 'ROUBO': 'roubo', 'FURTO': 'furto', 'ESTUPRO': 'estupro'
    };
    const normNat = natureza.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const cat = crimeMapping[normNat] || 'outros';
    
    const ano = row['Ano'] || new Date().getFullYear();
    const mes = String(row['Mes'] || '01').padStart(2, '0');
    
    records.push({
      target: 'indicators',
      data: { id: crypto.randomUUID(), sourceId: 'SESP-AC', stateCode: 'AC', municipalityName: municipio, category: cat, sourceCategory: natureza, period: `${ano}-${mes}`, value: total, unit: 'ocorrencias' }
    });
    return records;
  }
}
