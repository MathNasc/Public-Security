const fs = require('fs');
let code = fs.readFileSync('src/ingestion/adapters/federal/sinesp/SinespAdapter.ts', 'utf-8');

code = code.replace(
  "import * as csv from 'csv-parse/sync';",
  "import * as csv from 'csv-parse/sync';\nimport { GeoNormalizationService } from '../../../../services/GeoNormalizationService.js';"
);

code = code.replace(
  "export class SinespAdapter implements SecurityDataSource {",
  "export class SinespAdapter implements SecurityDataSource {\n  private geoService = new GeoNormalizationService();"
);

code = code.replace(
  "async parse(data: RawDataset): Promise<NormalizedRecord[]> {",
  "async parse(data: RawDataset): Promise<NormalizedRecord[]> {"
);

const oldPush = `
      normalized.push({
        source_record_id: sourceRecordId,
        country: 'BR',
        state_code: uf,
        municipality_name: municipio,
        category: crime,
        occurred_at: null, // Aggregated doesn't have an exact timestamp
        is_aggregated_indicator: true,
        value: vitimas,
        period_reference: period,
      });
`;

const newPush = `
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
`;

code = code.replace(/normalized\.push\(\{[^]*?\}\);/, newPush);

fs.writeFileSync('src/ingestion/adapters/federal/sinesp/SinespAdapter.ts', code);
console.log("Patched SinespAdapter");
