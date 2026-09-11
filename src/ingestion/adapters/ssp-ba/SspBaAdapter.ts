import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter.js';
import crypto from 'crypto';

export class SspBaAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Estatísticas Criminais SSP-BA",
      agency: "Secretaria da Segurança Pública da Bahia",
      frequency: "Mensal",
      coverage: "BA",
      limitations: ["Relatórios baseados em RISP/AISP (Regiões Integradas) mapeadas para municípios."]
    };
  }

  identifyVersion(): string { return "1.0.0"; }

  async discover(): Promise<DiscoveryResult> {
    const currentYear = new Date().getFullYear();
    return {
      source: "SSP-BA",
      dataset: "Indicadores_Criminais_BA",
      url: `https://www.ssp.ba.gov.br/estatisticas/${currentYear}.csv`,
      version: `${currentYear}-latest`,
      checksum: crypto.randomBytes(16).toString('hex')
    };
  }

  async download(destinationPath: string): Promise<string> { return destinationPath; }

  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    const records: ParsedRecord[] = [];
    const municipio = row['Municipio'] || row['Município'] || row['Cidade'] || '';
    const natureza = row['Natureza'] || row['Crime'] || row['CVLI'] || '';
    const total = parseInt(row['Total'] || row['Ocorrencias'] || '0', 10);
    
    if (!municipio || isNaN(total) || total === 0) return null;

    const crimeMapping: Record<string, string> = {
      'HOMICIDIO DOLOSO': 'homicidio', 'LATROCINIO': 'latrocinio', 'LESAO CORPORAL SEGUIDA DE MORTE': 'homicidio', 'ROUBO': 'roubo', 'FURTO': 'furto', 'ESTUPRO': 'estupro'
    };
    const normNat = natureza.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const cat = crimeMapping[normNat] || (normNat === 'CVLI' ? 'homicidio' : 'outros');
    
    const ano = row['Ano'] || new Date().getFullYear();
    const mes = String(row['Mes'] || '01').padStart(2, '0');
    
    records.push({
      target: 'indicators',
      data: { id: crypto.randomUUID(), sourceId: 'SSP-BA', stateCode: 'BA', municipalityName: municipio, category: cat, sourceCategory: natureza, period: `${ano}-${mes}`, value: total, unit: 'ocorrencias' }
    });
    return records;
  }
}
