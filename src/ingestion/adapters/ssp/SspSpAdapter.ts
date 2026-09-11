import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter.js';
import crypto from 'crypto';

/**
 * Adapter para SSP-SP (Secretaria de Segurança Pública de São Paulo)
 * Focado na ingestão de estatísticas criminais mensais por município/DP.
 */
export class SspSpAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Estatísticas Criminais SSP-SP",
      agency: "Secretaria de Segurança Pública do Estado de São Paulo",
      frequency: "Mensal",
      coverage: "SP",
      limitations: [
        "Atraso de publicação de cerca de 25 dias úteis no mês subsequente",
        "Coordenadas geográficas exatas nem sempre publicadas no agregado mensal"
      ]
    };
  }

  identifyVersion(): string {
    return "1.0.0";
  }

  async discover(): Promise<DiscoveryResult> {
    // Na prática, faríamos web scraping do portal da SSP (Ex: http://www.ssp.sp.gov.br/transparenciassp/)
    // ou buscaríamos a URL na API do Governo Aberto SP.
    // Para prova de conceito no Oracle VPS, vamos apontar para uma extração via API ou Mock URL oficial.
    
    // Simulação do descobrimento de link da última versão liberada
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // Mês atual
    
    // O SSP libera o mês anterior. Ex: em Setembro, libera Agosto.
    const url = `https://www.ssp.sp.gov.br/assets/downloads/Estatisticas_${currentYear}.csv`; 

    return {
      source: "SSP-SP",
      dataset: "Ocorrencias_Criminais",
      url: url,
      version: `${currentYear}-${currentMonth}`,
      checksum: crypto.randomBytes(16).toString('hex') // Simulando hash do Etag
    };
  }

  async download(destinationPath: string): Promise<string> {
    // Num cenário real, usaríamos o node-fetch para baixar o CSV
    // await downloadFile(url, destinationPath);
    // Mas portais governamentais costumam ter firewalls anti-robôs, 
    // então muitas vezes usamos Puppeteer headless ou headers de navegador simulado.
    
    console.log(`[SSP-SP Adapter] Iniciando extração dos dados... Simulando download para ${destinationPath}`);
    return destinationPath;
  }

  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    // O CSV do SSP costuma ter colunas como:
    // Municipio, Natureza, Ano, Mes, Total
    
    const records: ParsedRecord[] = [];
    
    // Dicionário de padronização
    const crimeMapping: Record<string, string> = {
      'HOMICÍDIO DOLOSO (2)': 'homicidio',
      'HOMICÍDIO CULPOSO POR ACIDENTE DE TRÂNSITO': 'homicidio_transito',
      'LATROCÍNIO': 'latrocinio',
      'ROUBO - OUTROS': 'roubo',
      'ROUBO DE VEÍCULO': 'roubo_veiculo',
      'FURTO - OUTROS': 'furto',
      'FURTO DE VEÍCULO': 'furto_veiculo',
      'ESTUPRO': 'estupro'
    };

    const natureza = row['Natureza'] || row['natureza'] || '';
    const total = parseInt(row['Total'] || row['total'] || '0', 10);
    
    if (isNaN(total) || total === 0) return null;

    const standardizedCategory = crimeMapping[natureza.toUpperCase().trim()] || 'outros';
    const ano = row['Ano'] || row['ano'];
    const mes = row['Mes'] || row['mes'] || row['Mês'];
    
    const periodStr = `${ano}-${String(mes).padStart(2, '0')}`;
    
    records.push({
      target: 'indicators',
      data: {
        id: crypto.randomUUID(),
        sourceId: 'SSP-SP',
        stateCode: 'SP',
        municipalityCode: row['Municipio'] || 'SP_Desconhecido',
        category: standardizedCategory,
        sourceCategory: natureza,
        period: periodStr,
        value: total,
        unit: 'ocorrencias'
      }
    });

    return records;
  }
}
