const fs = require('fs');
let code = fs.readFileSync('src/api/public.ts', 'utf-8');
code = code.replace("import { securityOccurrences, securityIndicators, municipalities, states } from '../db/schema.js';", "import { securityOccurrences, securityIndicators, geographicMunicipalities, geographicStates } from '../db/schema.js';");
fs.writeFileSync('src/api/public.ts', code);
console.log("Patched public.ts");
