import fs from 'fs';
let code = fs.readFileSync('src/ingestion/ssp/normalizer.ts', 'utf8');

code = code.replace(
  '  subcategory: string;',
  '  subcategory: string;\n  sourceCategory: string;'
);

code = code.replace(
  '    subcategory: natureza + (desdobramento ? ` - ${desdobramento}` : \'\'),',
  '    subcategory: natureza + (desdobramento ? ` - ${desdobramento}` : \'\'),\n    sourceCategory: natureza,'
);

fs.writeFileSync('src/ingestion/ssp/normalizer.ts', code);
