import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter.js';
import crypto from 'crypto';

export class SspDfAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Estatísticas Criminais SSP-DF",
      agency: "Secretaria de Estado de Segurança Pública do DF",
      frequency: "Mensal",
      coverage: "DF",
      limitations: ["Foco em Regiões Administrativas (RAs) processadas como municípios."]
    };
  }

  identifyVersion(): string { return "1.0.0"; }

  async discover(): Promise<DiscoveryResult> {
    const currentYear = new Date().getFullYear();
    return {
      source: "SSP-DF",
      dataset: "Ocorrencias_Criminais_DF",
      url: `https://ssp.df.gov.br/dados/${currentYear}.csv`,
      version: `${currentYear}-latest`,
      checksum: crypto.randomBytes(16).toString('hex')
    };
  }

  async download(destinationPath: string): Promise<string> { return destinationPath; }

  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    const records: ParsedRecord[] = [];
    const municipio = row['Regiao_Administrativa'] || row['RA'] || row['Cidade'] || 'Brasília';
    const natureza = row['Natureza'] || row['Crime'] || '';
    const total = parseInt(row['Total'] || '0', 10);
    
    if (isNaN(total) || total === 0) return null;

    const crimeMapping: Record<string, string> = {
      'HOMICIDIO': 'homicidio', 'LATROCINIO': 'latrocinio', 'ROUBO': 'roubo', 'FURTO': 'furto', 'ESTUPRO': 'estupro'
    };
    const normNat = natureza.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const cat = crimeMapping[normNat] || 'outros';
    
    const ano = row['Ano'] || new Date().getFullYear();
    const mes = String(row['Mes'] || '01').padStart(2, '0');
    
    records.push({
      target: 'indicators',
      data: { id: crypto.randomUUID(), sourceId: 'SSP-DF', stateCode: 'DF', municipalityName: municipio, category: cat, sourceCategory: natureza, period: `${ano}-${mes}`, value: total, unit: 'ocorrencias' }
    });
    return records;
  }
}
