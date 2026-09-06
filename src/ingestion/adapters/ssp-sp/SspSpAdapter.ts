import { SecurityDataSource, DatasetMetadata, RawDataset, NormalizedRecord, ValidationResult } from '../../core/types.js';
import { normalizeSspRecord } from '../../ssp/normalizer.js';
import { parseSspCsv } from '../../ssp/parser.js';
import { GeoNormalizationService } from '../../../services/GeoNormalizationService.js';
import * as fs from 'fs';
import * as path from 'path';

export class SspSpAdapter implements SecurityDataSource {
  id = 'ssp-sp-official';
  name = 'SSP-SP (Secretaria de Segurança Pública)';
  provider = 'Governo do Estado de São Paulo';
  country = 'BR';
  state = 'SP';
  update_frequency: 'monthly' = 'monthly';

  private geoService = new GeoNormalizationService();

  async discover(): Promise<DatasetMetadata[]> {
    console.log(`[SSP-SP Adapter] Discovering local sample datasets in uploads/ directory...`);
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      console.log(`[SSP-SP Adapter] Uploads directory not found, returning mock dataset metadata.`);
      return [{
        id: 'mock-ssp-sp-2023',
        name: 'Boletins de Ocorrência (Mock)',
        description: 'Mock data for testing',
        format: 'csv',
        geographic_level: 'granular',
        url: 'mock://data'
      }];
    }

    const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.csv'));
    
    return files.map(file => ({
      id: `ssp-sp-file-${file}`,
      name: `SSP-SP Arquivo: ${file}`,
      description: `Arquivo local de BOs da SSP-SP (${file})`,
      format: 'csv',
      geographic_level: 'granular',
      url: path.join(uploadsDir, file)
    }));
  }

  async fetch(dataset: DatasetMetadata): Promise<RawDataset> {
    console.log(`[SSP-SP Adapter] Fetching dataset: ${dataset.id} from ${dataset.url}`);
    
    let parsedData = [];
    if (dataset.url.startsWith('mock://')) {
      // Mock data
      parsedData = [
        {
          "NUM_BO": "1234/2023",
          "NATUREZA_APURADA": "ROUBO",
          "DATAOCORRENCIA": "15/05/2023",
          "HORAOCORRENCIA": "14:30",
          "LATITUDE": "-23.550520",
          "LONGITUDE": "-46.633308",
          "MUNICIPIO": "S. Paulo", // Messy name to test GeoNormalization
          "LOGRADOURO": "Praça da Sé",
          "NUMERO": "1"
        },
        {
          "NUM_BO": "5678/2023",
          "NATUREZA_APURADA": "FURTO DE VEÍCULO",
          "DATAOCORRENCIA": "16/05/2023",
          "HORAOCORRENCIA": "22:15",
          "LATITUDE": "-22.906847",
          "LONGITUDE": "-47.061095",
          "MUNICIPIO": "Campinas",
          "LOGRADOURO": "Av. Francisco Glicério",
          "NUMERO": "100"
        }
      ];
    } else {
      // Parse local CSV
      parsedData = await parseSspCsv(dataset.url);
    }

    return {
      metadata: dataset,
      data: parsedData
    };
  }

  async parse(raw: RawDataset): Promise<NormalizedRecord[]> {
    console.log(`[SSP-SP Adapter] Parsing ${raw.data.length} records...`);
    const normalized: NormalizedRecord[] = [];

    for (const rawRecord of raw.data) {
      // 1. Initial normalization via old SSP Normalizer logic
      const sspNorm = normalizeSspRecord(rawRecord);

      // 2. Enhance with Geographic Normalization & IBGE linking
      const dirtyCity = rawRecord['CIDADE'] || rawRecord['cidade'] || rawRecord['MUNICIPIO'] || '';
      
      let municipalityCode = undefined;
      
      if (dirtyCity) {
        const municipality = await this.geoService.findMunicipality(dirtyCity, 'SP');
        if (municipality) {
          municipalityCode = municipality.code;
        } else {
          console.warn(`[SSP-SP Adapter] Could not resolve municipality for: ${dirtyCity}`);
        }
      }

      normalized.push({
        source_record_id: sspNorm.source_record_id,
        country: 'BR',
        state_code: '35', // SP IBGE Code
        municipality_code: municipalityCode,
        category: sspNorm.category,
        subcategory: sspNorm.subcategory,
        occurred_at: sspNorm.occurred_at,
        latitude: sspNorm.latitude,
        longitude: sspNorm.longitude,
        location_precision: sspNorm.location_precision,
        original_address: sspNorm.original_address,
        is_aggregated_indicator: false
      });
    }

    return normalized;
  }

  async validate(records: NormalizedRecord[]): Promise<ValidationResult> {
    let valid = 0;
    let rejected = 0;
    const errors: string[] = [];

    for (const rec of records) {
      if (!rec.source_record_id) {
        rejected++;
        errors.push(`Missing source_record_id`);
        continue;
      }
      if (!rec.category) {
        rejected++;
        errors.push(`Missing category for record ${rec.source_record_id}`);
        continue;
      }
      valid++;
    }

    return {
      valid: valid > 0,
      total_records: records.length,
      valid_records: valid,
      rejected_records: rejected,
      errors: errors.slice(0, 100)
    };
  }
}
