import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter.js';
import crypto from 'crypto';

/**
 * Adapter para SESP-PR (Secretaria da Segurança Pública do Paraná)
 */
export class SespPrAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Estatísticas Criminais SESP-PR",
      agency: "Secretaria de Segurança Pública do Paraná",
      frequency: "Mensal",
      coverage: "PR",
      limitations: [
        "Os relatórios mensais podem sofrer revisão até o fechamento do quadrimestre",
        "Mapeamento por município consolida Boletins de Ocorrência Unificados (BOU)"
      ]
    };
  }

  identifyVersion(): string {
    return "1.0.0";
  }

  async discover(): Promise<DiscoveryResult> {
    const currentYear = new Date().getFullYear();
    const url = `https://www.seguranca.pr.gov.br/arquivos/File/Estatisticas/${currentYear}/estatisticas_criminais.csv`; 

    return {
      source: "SESP-PR",
      dataset: "Ocorrencias_Criminais_PR",
      url: url,
      version: `${currentYear}-latest`,
      checksum: crypto.randomBytes(16).toString('hex')
    };
  }

  async download(destinationPath: string): Promise<string> {
    console.log(`[SESP-PR Adapter] Iniciando extração dos dados... Simulando download para ${destinationPath}`);
    return destinationPath;
  }

  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    const records: ParsedRecord[] = [];
    
    const municipio = row['Municipio'] || row['Município'] || row['MUNICÍPIO'];
    const natureza = row['Natureza da Ocorrencia'] || row['Natureza'] || row['NATUREZA'] || '';
    const totalRaw = row['Quantidade'] || row['Total'] || row['QUANTIDADE'] || '0';
    const total = parseInt(totalRaw, 10);
    
    if (!municipio || isNaN(total) || total === 0) return null;

    const crimeMapping: Record<string, string> = {
      'HOMICIDIO DOLOSO': 'homicidio',
      'LATROCINIO': 'latrocinio',
      'ROUBO': 'roubo',
      'FURTO': 'furto',
      'ESTUPRO': 'estupro',
      'ROUBO DE VEICULO': 'roubo_veiculo',
      'FURTO DE VEICULO': 'furto_veiculo'
    };

    // Remove acentos para garantir mapeamento correto
    const normalizedNatureza = natureza.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const standardizedCategory = crimeMapping[normalizedNatureza] || 'outros';
    
    const ano = row['Ano'] || row['ANO'];
    const mes = String(row['Mes'] || row['Mês'] || row['MÊS']).padStart(2, '0');
    
    records.push({
      target: 'indicators',
      data: {
        id: crypto.randomUUID(),
        sourceId: 'SESP-PR',
        stateCode: 'PR',
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
