const fs = require('fs');
let code = fs.readFileSync('src/ingestion/pipeline/Worker.ts', 'utf8');
code = code.replace(
  /else if \(job\.source_id === 'SESP-PR'\) adapter = new SespPrAdapter\(\);/,
  "else if (job.source_id === 'SESP-PR') adapter = new SespPrAdapter();\n      else if (job.source_id === 'SSP-RS') adapter = new SspRsAdapter();"
);
fs.writeFileSync('src/ingestion/pipeline/Worker.ts', code);
