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
    const records: ParsedRecord[] = [];
    
    // Dicionário de padronização (SSP-SP Real)
    const crimeMapping: Record<string, string> = {
      'HOMICÍDIO DOLOSO (2)': 'homicide',
      'HOMICÍDIO DOLOSO': 'homicide',
      'HOMICÍDIO CULPOSO POR ACIDENTE DE TRÂNSITO': 'traffic_homicide',
      'LATROCÍNIO': 'robbery_with_death',
      'ROUBO - OUTROS': 'robbery',
      'ROUBO A BANCO': 'bank_robbery',
      'ROUBO DE CARGA': 'cargo_robbery',
      'ROUBO DE VEÍCULO': 'vehicle_robbery',
      'FURTO - OUTROS': 'theft',
      'FURTO DE VEÍCULO': 'vehicle_theft',
      'ESTUPRO': 'rape',
      'ESTUPRO DE VULNERÁVEL': 'statutory_rape'
    };

    const natureza = row['Natureza'] || row['NATUREZA'] || row['natureza'] || '';
    if (!natureza) return null;

    const standardizedCategory = crimeMapping[natureza.toUpperCase().trim()] || 'other';
    const municipioStr = row['Município'] || row['Municipio'] || row['MUNICÍPIO'] || row['municipio'] || row['Cidade'] || 'SP_Desconhecido';
    
    // Remove accents and uppercase to standardise
    const municipio = municipioStr.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const ano = row['Ano'] || row['ANO'] || row['ano'] || new Date().getFullYear();

    // Mapping months from Portuguese columns
    const meses = [
      { key: 'Janeiro', num: '01' }, { key: 'Fevereiro', num: '02' }, { key: 'Março', num: '03' },
      { key: 'Abril', num: '04' }, { key: 'Maio', num: '05' }, { key: 'Junho', num: '06' },
      { key: 'Julho', num: '07' }, { key: 'Agosto', num: '08' }, { key: 'Setembro', num: '09' },
      { key: 'Outubro', num: '10' }, { key: 'Novembro', num: '11' }, { key: 'Dezembro', num: '12' }
    ];

    // Check if it's the flattened format (with 'Mês' and 'Total' columns)
    const mesAchatado = row['Mês'] || row['Mes'] || row['mes'] || row['MES'];
    if (mesAchatado) {
       const total = parseInt(row['Total'] || row['total'] || '0', 10);
       if (!isNaN(total) && total > 0) {
         let mm = mesAchatado;
         // convert string month to number if needed
         const foundMonth = meses.find(m => m.key.toLowerCase() === mesAchatado.toLowerCase());
         if (foundMonth) mm = foundMonth.num;
         
         const periodStr = `${ano}-${String(mm).padStart(2, '0')}`;
         records.push({
           target: 'indicators',
           data: {
             id: crypto.randomUUID(),
             sourceId: 'ssp-sp',
             datasetId: 'indicadores_municipais_estado',
             stateCode: 'SP',
             municipalityCode: null, // Let the worker resolve this using muniCache (or IBGE lookup)
             municipalityName: municipio,
             category: standardizedCategory,
             sourceCategory: natureza,
             period: periodStr,
             value: total,
             unit: 'occurrences'
           }
         });
       }
    } else {
       // Format with columns for each month: "Janeiro", "Fevereiro", etc.
       for (const m of meses) {
          const valRaw = row[m.key] || row[m.key.toUpperCase()] || row[m.key.toLowerCase()];
          if (valRaw !== undefined && valRaw !== null && valRaw !== '') {
             const total = parseInt(valRaw, 10);
             if (!isNaN(total) && total > 0) {
                const periodStr = `${ano}-${m.num}`;
                records.push({
                   target: 'indicators',
                   data: {
                     id: crypto.randomUUID(),
                     sourceId: 'ssp-sp',
                     datasetId: 'indicadores_municipais_estado',
                     stateCode: 'SP',
                     municipalityCode: null, 
                     municipalityName: municipio,
                     category: standardizedCategory,
                     sourceCategory: natureza,
                     period: periodStr,
                     value: total,
                     unit: 'occurrences'
                   }
                });
             }
          }
       }
    }

    return records;
  }
}
