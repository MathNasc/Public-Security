import fs from 'fs';
const file = 'src/ingestion/adapters/sinesp/SinespAdapter.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'export class SinespAdapter {',
  'import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from "../BaseAdapter.js";\n\nexport class SinespAdapter extends BaseAdapter {'
);

code = code.replace(
  'async discover() {',
  'async discover(): Promise<DiscoveryResult> {'
);

code = code.replace(
  'metadata() {',
  'metadata(): AdapterMetadata {'
);

code = code.replace(
  'parseRow(row: any) {',
  'parseRow(row: any): ParsedRecord | null {'
);

// Add sourceCategory
code = code.replace(
  'category: this.normalize(crime || \'\'),',
  'category: this.normalize(crime || \'\'),\n      sourceCategory: crime || \'\','
);

fs.writeFileSync(file, code);
