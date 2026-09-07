import fs from 'fs';
const file = 'src/ingestion/pipeline/Worker.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('IspRjAdapter')) {
  code = code.replace(
    "import { SinespAdapter } from '../adapters/sinesp/SinespAdapter.js';",
    "import { SinespAdapter } from '../adapters/sinesp/SinespAdapter.js';\nimport { IspRjAdapter } from '../adapters/isp-rj/IspRjAdapter.js';"
  );
}

// Add the adapter factory
code = code.replace(
  "if (job.source_id === 'SSP-SP') adapter = new SspAdapter();\n      else if (job.source_id === 'SINESP') adapter = new SinespAdapter();\n      else throw new Error(\"Unknown adapter for source: \" + job.source_id);",
  "if (job.source_id === 'SSP-SP') adapter = new SspAdapter();\n      else if (job.source_id === 'SINESP') adapter = new SinespAdapter();\n      else if (job.source_id === 'ISP-RJ') adapter = new IspRjAdapter();\n      else throw new Error(\"Unknown adapter for source: \" + job.source_id);"
);

// Handle array response from parseRow
const oldResultCheck = `const result = adapter.parseRow(row);
          if (!result || !result.data) {
             metrics.recordsInvalid++;
             continue;
          }
          
          if (result.target === 'occurrences' && (!result.data.latitude || !result.data.longitude)) {
            metrics.recordsWithoutCoordinates++;
          }
          
          if (result.target === 'indicators' && result.data.municipalityName && !result.data.municipalityCode) {
            const normName = result.data.municipalityName.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim();
            const key = result.data.stateCode + '_' + normName;
            result.data.municipalityCode = this.muniCache.get(key) || null;
          }
          batch.push(result);`;

const newResultCheck = `let results = adapter.parseRow(row);
          if (!results) {
             metrics.recordsInvalid++;
             continue;
          }
          if (!Array.isArray(results)) results = [results];
          
          for (const result of results) {
            if (!result || !result.data) {
              metrics.recordsInvalid++;
              continue;
            }
            
            if (result.target === 'occurrences' && (!result.data.latitude || !result.data.longitude)) {
              metrics.recordsWithoutCoordinates++;
            }
            
            if (result.target === 'indicators' && result.data.municipalityName && !result.data.municipalityCode) {
              const normName = result.data.municipalityName.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim();
              const key = result.data.stateCode + '_' + normName;
              result.data.municipalityCode = this.muniCache.get(key) || null;
            }
            
            metrics.recordsValid++;
            batch.push(result);
          }`;

// We also need to remove the metrics.recordsValid++; that was originally right after oldResultCheck
code = code.replace(oldResultCheck, newResultCheck);
code = code.replace('metrics.recordsValid++;\n          batch.push(result);', ''); // Clean up any lingering one

fs.writeFileSync(file, code);
