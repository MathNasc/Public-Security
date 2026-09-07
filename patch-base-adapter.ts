import fs from 'fs';
let code = fs.readFileSync('src/ingestion/adapters/BaseAdapter.ts', 'utf8');
code = code.replace(
  'parseRow(row: any): ParsedRecord | null;',
  'parseRow(row: any): ParsedRecord[] | ParsedRecord | null;'
);
fs.writeFileSync('src/ingestion/adapters/BaseAdapter.ts', code);
