import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter.js';
import crypto from 'crypto';

export class SspScAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Estatísticas Criminais SSP-SC",
      agency: "Secretaria de Estado da Segurança Pública de SC",
      frequency: "Mensal",
      coverage: "SC",
      limitations: ["Foco em municípios maiores, defasagem de 30 dias."]
    };
  }

  identifyVersion(): string { return "1.0.0"; }

  async discover(): Promise<DiscoveryResult> {
    const currentYear = new Date().getFullYear();
    return {
      source: "SSP-SC",
      dataset: "Ocorrencias_Criminais_SC",
      url: `https://www.ssp.sc.gov.br/estatisticas/mensal_${currentYear}.csv`,
      version: `${currentYear}-latest`,
      checksum: crypto.randomBytes(16).toString('hex')
    };
  }

  async download(destinationPath: string): Promise<string> { return destinationPath; }

  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    const records: ParsedRecord[] = [];
    const municipio = row['Municipio'] || row['Município'] || row['MUNICÍPIO'];
    const natureza = row['Delito'] || row['Crime'] || row['Natureza'] || '';
    const total = parseInt(row['Total'] || row['Quantidade'] || '0', 10);
    
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
      data: { id: crypto.randomUUID(), sourceId: 'SSP-SC', stateCode: 'SC', municipalityName: municipio, category: cat, sourceCategory: natureza, period: `${ano}-${mes}`, value: total, unit: 'ocorrencias' }
    });
    return records;
  }
}
