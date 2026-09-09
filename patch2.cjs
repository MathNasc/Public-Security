const fs = require('fs');
const file = 'src/ingestion/ssp/importer.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  "import { DataIngestionService } from '../../services/DataIngestionService.js';",
  "import { DataIngestionService } from '../../services/DataIngestionService.js';\nimport crypto from 'crypto';"
);
content = content.replace(
  "filename: fileName\n    };",
  "filename: fileName,\n      batchId: crypto.randomUUID()\n    };"
);
fs.writeFileSync(file, content);
