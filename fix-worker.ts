import fs from 'fs';
const file = 'src/ingestion/pipeline/Worker.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  '        category: r.category,\n        source_category: r.sourceCategory,\n        subcategory: r.subcategory,\n        source_category: r.sourceCategory,',
  '        category: r.category,\n        subcategory: r.subcategory,\n        source_category: r.sourceCategory,'
);

fs.writeFileSync(file, code);
