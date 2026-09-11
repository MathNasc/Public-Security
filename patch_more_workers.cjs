const fs = require('fs');
let code = fs.readFileSync('src/ingestion/pipeline/Worker.ts', 'utf8');

// Adiciona as imports no topo (logo depois do rs)
code = code.replace(
  /import \{ SspRsAdapter \} from '\.\.\/adapters\/ssp-rs\/SspRsAdapter\.js';/,
  `import { SspRsAdapter } from '../adapters/ssp-rs/SspRsAdapter.js';
import { SspScAdapter } from '../adapters/ssp-sc/SspScAdapter.js';
import { SspBaAdapter } from '../adapters/ssp-ba/SspBaAdapter.js';
import { SdsPeAdapter } from '../adapters/sds-pe/SdsPeAdapter.js';
import { SspdsCeAdapter } from '../adapters/sspds-ce/SspdsCeAdapter.js';
import { SspDfAdapter } from '../adapters/ssp-df/SspDfAdapter.js';
import { SspGoAdapter } from '../adapters/ssp-go/SspGoAdapter.js';`
);

// Adiciona no loop de inicialização
code = code.replace(
  /else if \(job\.source_id === 'SSP-RS'\) adapter = new SspRsAdapter\(\);/,
  `else if (job.source_id === 'SSP-RS') adapter = new SspRsAdapter();
      else if (job.source_id === 'SSP-SC') adapter = new SspScAdapter();
      else if (job.source_id === 'SSP-BA') adapter = new SspBaAdapter();
      else if (job.source_id === 'SDS-PE') adapter = new SdsPeAdapter();
      else if (job.source_id === 'SSPDS-CE') adapter = new SspdsCeAdapter();
      else if (job.source_id === 'SSP-DF') adapter = new SspDfAdapter();
      else if (job.source_id === 'SSP-GO') adapter = new SspGoAdapter();`
);

fs.writeFileSync('src/ingestion/pipeline/Worker.ts', code);
