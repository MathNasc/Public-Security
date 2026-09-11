import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter.js';
import crypto from 'crypto';

/**
 * Adapter para ISP-RJ (Instituto de Segurança Pública do Rio de Janeiro)
 * Focado na ingestão da "BaseDP" (Estatísticas Criminais por Delegacia/Município mensal).
 */
export class IspRjAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Estatísticas Criminais BaseDP",
      agency: "Instituto de Segurança Pública (ISP-RJ)",
      frequency: "Mensal",
      coverage: "RJ",
      limitations: [
        "BaseDP agrega por Delegacia (CISP), requerendo cruzamento para totalizar município",
        "Atraso padrão de publicação (45 a 60 dias)"
      ]
    };
  }

  identifyVersion(): string {
    return "1.0.0";
  }

  async discover(): Promise<DiscoveryResult> {
    // O ISP-RJ disponibiliza dados abertos no portal (http://www.ispdados.rj.gov.br/)
    // O arquivo principal é o BaseMunicipioMensal ou BaseDPMensal
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    const url = `http://www.ispdados.rj.gov.br/Arquivos/BaseMunicipioMensal.csv`; 

    return {
      source: "ISP-RJ",
      dataset: "Estatisticas_Criminais",
      url: url,
      version: `${currentYear}-${currentMonth}`,
      checksum: crypto.randomBytes(16).toString('hex')
    };
  }

  async download(destinationPath: string): Promise<string> {
    console.log(`[ISP-RJ Adapter] Iniciando extração dos dados... Simulando download para ${destinationPath}`);
    return destinationPath;
  }

  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    // O CSV do ISP-RJ possui formato "largo" (wide), onde cada tipo de crime é uma coluna
    // Ex colunas: fmun, ano, mes, hom_doloso, latrocinio, roubo_veiculo, furto_veiculos, estupro
    
    const records: ParsedRecord[] = [];
    
    // Pula linhas vazias
    if (!row['ano'] || !row['fmun']) return null;

    const municipio = row['fmun'];
    const ano = row['ano'];
    const mes = String(row['mes']).padStart(2, '0');
    const periodStr = `${ano}-${mes}`;

    // Dicionário de crimes (Coluna no CSV do ISP -> Nossa taxonomia)
    const crimesToMap = [
      { ispCol: 'hom_doloso', category: 'homicidio' },
      { ispCol: 'latrocinio', category: 'latrocinio' },
      { ispCol: 'roubo_veiculo', category: 'roubo_veiculo' },
      { ispCol: 'furto_veiculos', category: 'furto_veiculo' },
      { ispCol: 'estupro', category: 'estupro' },
      { ispCol: 'roubo_transeunte', category: 'roubo' },
      { ispCol: 'furto_transeunte', category: 'furto' }
    ];

    crimesToMap.forEach(mapping => {
      const valor = parseInt(row[mapping.ispCol] || '0', 10);
      
      if (!isNaN(valor) && valor > 0) {
        records.push({
          target: 'indicators',
          data: {
            id: crypto.randomUUID(),
            sourceId: 'ISP-RJ',
            stateCode: 'RJ',
            municipalityName: municipio, // Worker vai tentar achar o IBGE Code
            category: mapping.category,
            sourceCategory: mapping.ispCol,
            period: periodStr,
            value: valor,
            unit: 'ocorrencias'
          }
        });
      }
    });

    return records.length > 0 ? records : null;
  }
}
