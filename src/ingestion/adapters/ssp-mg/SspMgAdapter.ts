import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter.js';
import crypto from 'crypto';

/**
 * Adapter para SSP-MG / SEJUSP-MG (Secretaria de Estado de Justiça e Segurança Pública de Minas Gerais)
 */
export class SspMgAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Estatísticas Criminais SEJUSP-MG",
      agency: "Secretaria de Estado de Justiça e Segurança Pública (MG)",
      frequency: "Mensal",
      coverage: "MG",
      limitations: [
        "Dados agregados por município e data do fato",
        "Pode conter defasagem de até 30 dias na consolidação"
      ]
    };
  }

  identifyVersion(): string {
    return "1.0.0";
  }

  async discover(): Promise<DiscoveryResult> {
    const currentYear = new Date().getFullYear();
    const url = `http://dados.mg.gov.br/dataset/estatisticas-criminais-${currentYear}.csv`; 

    return {
      source: "SSP-MG",
      dataset: "Ocorrencias_Criminais_MG",
      url: url,
      version: `${currentYear}-latest`,
      checksum: crypto.randomBytes(16).toString('hex')
    };
  }

  async download(destinationPath: string): Promise<string> {
    console.log(`[SEJUSP-MG Adapter] Iniciando extração dos dados... Simulando download para ${destinationPath}`);
    return destinationPath;
  }

  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    const records: ParsedRecord[] = [];
    
    // Nomes de colunas comuns nos datasets do Governo de MG
    const municipio = row['Municipio'] || row['municipio'] || row['MUNICÍPIO'];
    const natureza = row['Natureza'] || row['natureza'] || row['NATUREZA'] || '';
    const totalRaw = row['Total'] || row['Registros'] || row['total'] || row['REGISTROS'] || '0';
    const total = parseInt(totalRaw, 10);
    
    if (!municipio || isNaN(total) || total === 0) return null;

    const crimeMapping: Record<string, string> = {
      'HOMICÍDIO CONSUMADO': 'homicidio',
      'HOMICÍDIO TENTADO': 'homicidio_tentado',
      'LATROCÍNIO': 'latrocinio',
      'ROUBO CONSUMADO': 'roubo',
      'FURTO CONSUMADO': 'furto',
      'ESTUPRO CONSUMADO': 'estupro',
      'ROUBO DE VEÍCULO': 'roubo_veiculo',
      'FURTO DE VEÍCULO': 'furto_veiculo'
    };

    const standardizedCategory = crimeMapping[natureza.toUpperCase().trim()] || 'outros';
    const ano = row['Ano'] || row['ano'] || row['ANO'];
    const mes = String(row['Mes'] || row['mes'] || row['MÊS']).padStart(2, '0');
    
    records.push({
      target: 'indicators',
      data: {
        id: crypto.randomUUID(),
        sourceId: 'SSP-MG',
        stateCode: 'MG',
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
