import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter';

export class IspRjAdapter extends BaseAdapter {
  async discover(): Promise<DiscoveryResult> {
    return {
      source: 'ISP-RJ',
      dataset: 'indicadores_municipais',
      url: 'https://www.ispdados.rj.gov.br/Arquivos/BaseMunicipioMensal.csv',
      version: this.identifyVersion(),
      checksum: crypto.createHash('sha256').update('isp-rj-version-mock').digest('hex')
    };
  }

  identifyVersion(): string {
    return '2024-01'; // Mocked
  }

  async download(destinationPath: string): Promise<string> {
    const fixturePath = path.join(process.cwd(), 'src/ingestion/adapters/isp-rj/fixtures/isp_rj_sample.csv');
    fs.copyFileSync(fixturePath, destinationPath);
    return destinationPath;
  }

  metadata(): AdapterMetadata {
    return {
      name: 'Base de Dados de Municípios (Mensal) - ISP/RJ',
      agency: 'Instituto de Segurança Pública do Rio de Janeiro',
      frequency: 'Mensal',
      coverage: 'Estadual (RJ)',
      limitations: ['Agregado por município', 'Sem coordenadas', 'Formato horizontal (colunas por crime)']
    };
  }

  parseRow(row: any): ParsedRecord[] | null {
    if (!row.ano || !row.mes || !row.fmun) return null;
    
    const mm = row.mes.toString().padStart(2, '0');
    const period = `${row.ano}-${mm}`;
    const ibgeCode = row.fmun.toString();
    const records: ParsedRecord[] = [];

    const categories = [
      { key: 'hom_doloso', internal: 'homicidio_doloso' },
      { key: 'latrocinio', internal: 'latrocinio' },
      { key: 'roubo_veiculo', internal: 'roubo_veiculo' },
      { key: 'furto_veiculos', internal: 'furto_veiculo' }
    ];

    for (const cat of categories) {
      if (row[cat.key] !== undefined && row[cat.key] !== '') {
        const val = parseInt(row[cat.key], 10);
        if (!isNaN(val)) {
          records.push({
            target: 'indicators',
            data: {
              sourceId: 'ISP-RJ',
              datasetId: 'indicadores_municipais',
              stateCode: 'RJ',
              municipalityCode: ibgeCode,
              municipalityName: row.munic,
              category: cat.internal,
              sourceCategory: cat.key,
              period: period,
              value: val,
              unit: 'occurrences'
            }
          });
        }
      }
    }

    return records.length > 0 ? records : null;
  }
}
