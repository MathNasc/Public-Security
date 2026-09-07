import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

// Also deduplicate schema imports
code = code.replace(/import \{ dataSources, dataImports, securityOccurrences, securityIndicators \} from '.\/src\/db\/schema.js';\n/g, '');
code = code.replace(/import \{ geographicStates, geographicMunicipalities \} from '.\/src\/db\/schema.js';\n/g, '');
code = code.replace(/import \{ ingestionJobs, dataDatasets, rawStorage \} from '.\/src\/db\/schema.js';\n/g, '');

const unifiedSchemaImport = `import { dataSources, dataImports, securityOccurrences, securityIndicators, geographicStates, geographicMunicipalities, ingestionJobs, dataDatasets, rawStorage } from './src/db/schema.js';\n`;
code = unifiedSchemaImport + code;

fs.writeFileSync('server.ts', code);
