import fs from 'fs';
let code = fs.readFileSync('src/db/schema.ts', 'utf8');
const tag = "// ==============================================\n// 6. CONTINUOUS INGESTION (PHASE 10)\n// ==============================================";
const idx = code.indexOf(tag);
if (idx > -1) {
  code = code.substring(0, idx);
  fs.writeFileSync('src/db/schema.ts', code);
}
