import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "import { dataSources, dataImports, securityOccurrences, securityIndicators, geographicStates, geographicMunicipalities, ingestionJobs, dataDatasets, rawStorage } from './src/db/schema.js';",
  "import { dataSources, dataImports, securityOccurrences, securityIndicators, geographicStates, geographicMunicipalities, ingestionJobs, dataDatasets, rawStorage, regionWatchlists } from './src/db/schema.js';"
);

fs.writeFileSync('server.ts', code);
