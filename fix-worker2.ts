import fs from 'fs';
const file = 'src/ingestion/pipeline/Worker.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  '        category: r.category,\n        period: r.period,',
  '        category: r.category,\n        source_category: r.sourceCategory,\n        period: r.period,'
);

fs.writeFileSync(file, code);
