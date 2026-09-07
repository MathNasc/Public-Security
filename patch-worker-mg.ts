import fs from 'fs';
const file = 'src/ingestion/pipeline/Worker.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('SspMgAdapter')) {
  code = code.replace(
    "import { IspRjAdapter } from '../adapters/isp-rj/IspRjAdapter.js';",
    "import { IspRjAdapter } from '../adapters/isp-rj/IspRjAdapter.js';\nimport { SspMgAdapter } from '../adapters/ssp-mg/SspMgAdapter.js';"
  );
}

// Add the adapter factory
code = code.replace(
  "else if (job.source_id === 'ISP-RJ') adapter = new IspRjAdapter();",
  "else if (job.source_id === 'ISP-RJ') adapter = new IspRjAdapter();\n      else if (job.source_id === 'SSP-MG') adapter = new SspMgAdapter();"
);

fs.writeFileSync(file, code);
