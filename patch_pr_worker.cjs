const fs = require('fs');
let code = fs.readFileSync('src/ingestion/pipeline/Worker.ts', 'utf8');
code = code.replace(
  /else if \(job\.source_id === 'SSP-MG'\) adapter = new SspMgAdapter\(\);/,
  "else if (job.source_id === 'SSP-MG') adapter = new SspMgAdapter();\n      else if (job.source_id === 'SESP-PR') adapter = new SespPrAdapter();"
);
fs.writeFileSync('src/ingestion/pipeline/Worker.ts', code);
