import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

// The first two lines were added as duplicate imports by my earlier script:
// import { globalScheduler } from './src/ingestion/orchestration/Scheduler.js';
// import { ingestionJobs, dataDatasets, rawStorage } from './src/db/schema.js';

// Let's just fix the rawStorage error line 373 if it exists, or duplicate db/eq
code = code.replace(/import \{ ingestionJobs, dataDatasets, rawStorage \} from '.\/src\/db\/schema.js';/g, '');
code = code.replace(/import \{ globalScheduler \} from '.\/src\/ingestion\/orchestration\/Scheduler.js';/g, '');

const properImports = `
import { globalScheduler } from './src/ingestion/orchestration/Scheduler.js';
import { ingestionJobs, dataDatasets, rawStorage } from './src/db/schema.js';
`;
code = properImports + code;

fs.writeFileSync('server.ts', code);
