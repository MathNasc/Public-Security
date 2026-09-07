import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/import \{ rawStorage \} from '.\/src\/ingestion\/pipeline\/Storage.js';/g, 'import { rawStorage as pipelineRawStorage } from \'./src/ingestion/pipeline/Storage.js\';');
code = code.replace(/await rawStorage\.put\(/g, 'await pipelineRawStorage.put(');
// also fix duplicate db and eq imports
code = code.replace(/import \{ eq, desc, sql \} from 'drizzle-orm';\n/g, '');
code = code.replace(/import \{ db \} from '\.\/src\/db\/index\.js';\n/g, '');

fs.writeFileSync('server.ts', code);
