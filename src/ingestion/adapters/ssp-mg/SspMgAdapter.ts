import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter';

export class SspMgAdapter extends BaseAdapter {
  async discover(): Promise<DiscoveryResult> {
    return {
      source: 'SSP-MG',
      dataset: 'indicadores_municipais',
      url: 'http://www.seguranca.mg.gov.br/dados',
      version: this.identifyVersion(),
      checksum: crypto.createHash('sha256').update('ssp-mg-version-mock').digest('hex')
    };
  }

  identifyVersion(): string {
    return '2024-01'; // Mocked
  }

  async download(destinationPath: string): Promise<string> {
    const fixturePath = path.join(process.cwd(), 'src/ingestion/adapters/ssp-mg/fixtures/ssp_mg_sample.csv');
    fs.copyFileSync(fixturePath, destinationPath);
    return destinationPath;
  }

  metadata(): AdapterMetadata {
    return {
      name: 'Estatísticas Criminais (Municípios) - SSP/MG',
      agency: 'Secretaria de Estado de Justiça e Segurança Pública (SEJUSP/MG)',
      frequency: 'Mensal',
      coverage: 'Estadual (MG)',
      limitations: ['Agregado por município', 'Sem coordenadas']
    };
  }
  
  normalize(crime: string): string {
    const l = crime.toLowerCase();
    if (l.includes('homicídio')) return 'homicidio_doloso';
    if (l.includes('roubo de veículo') || l.includes('roubo de veiculo')) return 'roubo_veiculo';
    if (l.includes('furto de veículo')) return 'furto_veiculo';
    if (l.includes('roubo')) return 'roubo';
    if (l.includes('furto')) return 'furto';
    return 'outros';
  }

  parseRow(row: any): ParsedRecord | null {
    if (!row.Ano || !row.Mês || !row['Município']) return null;
    
    const mm = row.Mês.toString().padStart(2, '0');
    const period = `${row.Ano}-${mm}`;
    
    const ocorrencias = parseInt(row['Qtde Ocorrências'] || '0', 10);
    if (isNaN(ocorrencias) || ocorrencias === 0) return null;

    return {
      target: 'indicators',
      data: {
        sourceId: 'SSP-MG',
        datasetId: 'indicadores_municipais',
        stateCode: 'MG',
        municipalityName: row['Município'],
        category: this.normalize(row.Natureza || ''),
        sourceCategory: row.Natureza || '',
        period: period,
        value: ocorrencias,
        unit: 'occurrences'
      }
    };
  }
}
