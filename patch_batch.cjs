const fs = require('fs');
const files = [
  'src/ingestion/parsers/SinespParser.ts',
  'src/ingestion/parsers/IspRjParser.ts',
  'src/ingestion/parsers/BaParser.ts',
  'src/ingestion/parsers/CeParser.ts',
  'src/ingestion/parsers/SpParser.ts',
  'src/ingestion/parsers/RsParser.ts'
];
for (const f of files) {
   let code = fs.readFileSync(f, 'utf8');
   code = code.replace(/batch\.length >= 40/g, 'batch.length >= 10');
   fs.writeFileSync(f, code);
}
console.log("Patched all to batch 10");
