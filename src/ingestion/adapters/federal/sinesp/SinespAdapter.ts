import { SecurityDataSource, DatasetMetadata, RawDataset, NormalizedRecord, ValidationResult } from '../../../core/types.js';
import * as csv from 'csv-parse/sync';
import { GeoNormalizationService } from '../../../../services/GeoNormalizationService.js';

export class SinespAdapter implements SecurityDataSource {
  private geoService = new GeoNormalizationService();
  id = 'sinesp-national';
  name = 'SINESP - Dados Nacionais de Segurança Pública';
  provider = 'Ministério da Justiça e Segurança Pública (MJSP)';
  country = 'BR';
  update_frequency = 'monthly' as const;

  async discover(): Promise<DatasetMetadata[]> {
    return [{
      id: 'sinesp-municipios',
      name: 'Ocorrências Criminais por Município',
      description: 'Indicadores criminais agregados por município e mês.',
      format: 'csv',
      geographic_level: 'municipality',
      url: 'https://dados.mj.gov.br/dataset/indicadores-municipais',
    }];
  }

  async fetch(dataset: DatasetMetadata): Promise<RawDataset> {
    console.log(`[SINESP ADAPTER] Simulating download from SINESP: ${dataset.url}`);
    
    // SINESP files are extremely large and often behind a WAF or require specific TLS. 
    // For Phase 1 validation, we mock the exact structure of SINESP CSV to test the Engine architecture.
    const mockCsv = `Município,Sigla UF,Região,Mês/Ano,Vítima,Crime
São Paulo,SP,Sudeste,01/2025,12,Homicídio doloso
Rio de Janeiro,RJ,Sudeste,01/2025,8,Homicídio doloso
Curitiba,PR,Sul,01/2025,3,Roubo de veículo
Belo Horizonte,MG,Sudeste,02/2025,5,Roubo de carga
Fortaleza,CE,Nordeste,02/2025,6,Homicídio doloso`;

    return {
      metadata: dataset,
      data: mockCsv
    };
  }

  async parse(data: RawDataset): Promise<NormalizedRecord[]> {
    const rawCsv = data.data;
    const records = csv.parse(rawCsv, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ','
    });

    const normalized: NormalizedRecord[] = [];

    for (const row of records) {
      const municipio = row['Município'];
      const uf = row['Sigla UF'];
      const mesAno = row['Mês/Ano']; // e.g., 01/2025
      const vitimas = parseInt(row['Vítima'] || row['Ocorrências'] || '0');
      const crime = row['Crime'];

      if (!uf || !crime) continue;

      let period = mesAno;
      if (mesAno && mesAno.includes('/')) {
        const parts = mesAno.split('/');
        if (parts.length === 2) period = `${parts[1]}-${parts[0]}`; // YYYY-MM
      }

      const sourceRecordId = `sinesp-${uf}-${municipio}-${period}-${crime}`.toLowerCase().replace(/\\s+/g, '-');

      
      let municipalityCode = undefined;
      if (municipio && uf) {
        const found = await this.geoService.findMunicipality(municipio, uf);
        if (found) {
          municipalityCode = found.code;
        }
      }

      normalized.push({
        source_record_id: sourceRecordId,
        country: 'BR',
        state_code: uf,
        municipality_code: municipalityCode,
        category: crime,
        occurred_at: null,
        is_aggregated_indicator: true,
        value: vitimas,
        period_reference: period,
      });

    }

    return normalized;
  }

  async validate(records: NormalizedRecord[]): Promise<ValidationResult> {
    let rejected = 0;
    for (const r of records) {
      if (!r.category || !r.state_code || !r.period_reference) {
        rejected++;
      }
    }
    return {
      valid: true,
      total_records: records.length,
      valid_records: records.length - rejected,
      rejected_records: rejected,
      errors: []
    };
  }
}
