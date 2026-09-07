import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'import { dataSources, securityOccurrences, dataImports } from "./src/db/schema.js";',
  '// Removed duplicate import'
);

fs.writeFileSync('server.ts', code);
