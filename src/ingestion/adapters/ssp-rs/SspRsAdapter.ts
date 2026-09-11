import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter.js';
import crypto from 'crypto';

/**
 * Adapter para SSP-RS (Secretaria da Segurança Pública do Rio Grande do Sul)
 */
export class SspRsAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Indicadores Criminais SSP-RS",
      agency: "Secretaria de Segurança Pública do RS",
      frequency: "Mensal",
      coverage: "RS",
      limitations: [
        "A base estadual pode ter latência de consolidação",
        "Formato frequentemente em CSV separado por tipo de crime"
      ]
    };
  }

  identifyVersion(): string {
    return "1.0.0";
  }

  async discover(): Promise<DiscoveryResult> {
    const currentYear = new Date().getFullYear();
    const url = `https://ssp.rs.gov.br/upload/arquivos/indicadores_criminais_${currentYear}.csv`; 

    return {
      source: "SSP-RS",
      dataset: "Indicadores_Criminais_RS",
      url: url,
      version: `${currentYear}-latest`,
      checksum: crypto.randomBytes(16).toString('hex')
    };
  }

  async download(destinationPath: string): Promise<string> {
    console.log(`[SSP-RS Adapter] Iniciando extração dos dados... Simulando download para ${destinationPath}`);
    return destinationPath;
  }

  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    const records: ParsedRecord[] = [];
    
    // Nomenclaturas comuns no portal SSP-RS
    const municipio = row['Municipio'] || row['Município'] || row['MUNICÍPIO'];
    const natureza = row['Crime'] || row['Indicador'] || row['Natureza'] || '';
    const totalRaw = row['Total'] || row['Frequencia'] || row['Ocorrencias'] || '0';
    const total = parseInt(totalRaw, 10);
    
    if (!municipio || isNaN(total) || total === 0) return null;

    const crimeMapping: Record<string, string> = {
      'HOMICIDIO DOLOSO': 'homicidio',
      'LATROCINIO': 'latrocinio',
      'ROUBO DE VEICULO': 'roubo_veiculo',
      'ROUBO A PEDESTRE': 'roubo',
      'FURTO DE VEICULO': 'furto_veiculo',
      'FURTO': 'furto',
      'ESTUPRO': 'estupro'
    };

    const normalizedNatureza = natureza.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const standardizedCategory = crimeMapping[normalizedNatureza] || 'outros';
    
    const ano = row['Ano'] || row['ANO'];
    const mes = String(row['Mes'] || row['Mês'] || row['MÊS']).padStart(2, '0');
    
    records.push({
      target: 'indicators',
      data: {
        id: crypto.randomUUID(),
        sourceId: 'SSP-RS',
        stateCode: 'RS',
        municipalityName: municipio,
        category: standardizedCategory,
        sourceCategory: natureza,
        period: `${ano}-${mes}`,
        value: total,
        unit: 'ocorrencias'
      }
    });

    return records;
  }
}
