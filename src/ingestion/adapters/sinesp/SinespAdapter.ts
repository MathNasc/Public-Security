import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter.js';

export class SinespAdapter extends BaseAdapter {
  // Official MJSP Sinesp Municipal Indicators URL
  private officialUrl = 'https://dados.mj.gov.br/dataset/210b1adee-588e-47f6-84d4-28247076a02b/resource/d4d12c82-c84a-4ff1-88f6-df21f37ccb83/download/indicadoressegurancapublicamunicipios.csv';

  async discover(): Promise<DiscoveryResult> {
    // Discovers the latest version. Usually we'd do a HEAD request.
    return {
      source: 'SINESP',
      dataset: 'indicadores_municipais',
      url: this.officialUrl,
      version: this.identifyVersion(),
      checksum: crypto.createHash('sha256').update('sinesp-current-version').digest('hex')
    };
  }

  identifyVersion() {
    // SINESP files are typically identified by the last month they cover (e.g. 2024-01)
    return '2024-01'; // Mocked for the current snapshot
  }

  async download(destinationPath: string) {
    try {
      console.log(`[SinespAdapter] Downloading real official dataset from ${this.officialUrl}`);
      const response = await axios({
        url: this.officialUrl,
        method: 'GET',
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(destinationPath);
      response.data.pipe(writer);

      return new Promise<string>((resolve, reject) => {
        writer.on('finish', () => resolve(destinationPath));
        writer.on('error', reject);
      });
    } catch (e: any) {
      console.warn(`[SinespAdapter] Network download failed (${e.message}). Falling back to local fixture if available...`);
      const fixturePath = path.join(process.cwd(), 'src/ingestion/adapters/sinesp/fixtures/sinesp_sample.csv');
      if (fs.existsSync(fixturePath)) {
        fs.copyFileSync(fixturePath, destinationPath);
        return destinationPath;
      }
      throw e;
    }
  }

  metadata(): AdapterMetadata {
    return {
      name: 'Indicadores Criminais Municipais - SINESP',
      agency: 'Ministério da Justiça e Segurança Pública (MJSP)',
      frequency: 'Mensal',
      coverage: 'Nacional',
      limitations: ['Agregado por município', 'Sem coordenadas geográficas (geom=NULL)', 'Pode sofrer revisões históricas']
    };
  }

  normalize(raw: string) {
    const l = raw.toLowerCase();
    if (l.includes('homicídio doloso')) return 'homicidio_doloso';
    if (l.includes('roubo de veículo')) return 'roubo_veiculo';
    if (l.includes('furto de veículo')) return 'furto_veiculo';
    if (l.includes('roubo de carga')) return 'roubo_carga';
    if (l.includes('latrocínio')) return 'latrocinio';
    if (l.includes('estupro')) return 'estupro';
    return 'outros';
  }

  validate(row: any) {
    if (!row.stateCode || !row.municipalityName || !row.category || !row.period) return false;
    return true;
  }

  parseRow(row: any): ParsedRecord | null {
    const uf = row.UF || row.uf;
    const city = row.Município || row['Municipio'] || row.municipio;
    const crime = row['Tipo Crime'] || row['tipo_crime'];
    const ano = row.Ano || row.ano;
    const mes = row.Mês || row.mes || row.Mes;
    const ocorrencias = row.Ocorrências || row.ocorrencias || row.Ocorrencias || 0;

    const monthMap: Record<string, string> = {
      'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
      'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
      'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
    };
    const mm = monthMap[mes?.toLowerCase()] || '01';

    const normalizedData = {
      sourceId: 'SINESP',
      datasetId: 'indicadores_municipais',
      stateCode: uf,
      municipalityName: city,
      category: this.normalize(crime || ''),
      sourceCategory: crime || '',
      period: `${ano}-${mm}`,
      value: parseInt(ocorrencias, 10),
      unit: 'occurrences'
    };

    if (!this.validate(normalizedData)) return null;

    return {
      target: 'indicators',
      data: normalizedData
    };
  }
}
