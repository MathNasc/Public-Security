import { importSspFile } from './src/ingestion/ssp/importer.js';
import * as fs from 'fs';
fs.writeFileSync('test.csv', 'source_record_id,category\n123,Furto\n');
importSspFile('test.csv').then(console.log).catch(e => console.error(e.message));
