import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter.js';
import crypto from 'crypto';

export class SdsPeAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Estatísticas Criminais SDS-PE",
      agency: "Secretaria de Defesa Social de Pernambuco",
      frequency: "Mensal",
      coverage: "PE",
      limitations: ["Foco em CVLI (Crimes Violentos Letais Intencionais) e CVP."]
    };
  }

  identifyVersion(): string { return "1.0.0"; }

  async discover(): Promise<DiscoveryResult> {
    const currentYear = new Date().getFullYear();
    return {
      source: "SDS-PE",
      dataset: "CVLI_CVP_PE",
      url: `https://www.sds.pe.gov.br/estatisticas/${currentYear}.csv`,
      version: `${currentYear}-latest`,
      checksum: crypto.randomBytes(16).toString('hex')
    };
  }

  async download(destinationPath: string): Promise<string> { return destinationPath; }

  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    const records: ParsedRecord[] = [];
    const municipio = row['Municipio'] || row['Município'] || '';
    const natureza = row['Natureza'] || row['Crime'] || row['Indicador'] || '';
    const total = parseInt(row['Total'] || row['Vitimas'] || '0', 10);
    
    if (!municipio || isNaN(total) || total === 0) return null;

    const crimeMapping: Record<string, string> = {
      'CVLI': 'homicidio', 'CVP': 'roubo', 'ESTUPRO': 'estupro', 'FURTO': 'furto'
    };
    const normNat = natureza.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const cat = crimeMapping[normNat] || 'outros';
    
    const ano = row['Ano'] || new Date().getFullYear();
    const mes = String(row['Mes'] || '01').padStart(2, '0');
    
    records.push({
      target: 'indicators',
      data: { id: crypto.randomUUID(), sourceId: 'SDS-PE', stateCode: 'PE', municipalityName: municipio, category: cat, sourceCategory: natureza, period: `${ano}-${mes}`, value: total, unit: 'ocorrencias' }
    });
    return records;
  }
}
