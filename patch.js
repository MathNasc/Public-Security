const fs = require('fs');
let code = fs.readFileSync('src/ingestion/pipeline/IngestionWorker.ts', 'utf8');

if (!code.includes('import { SpParser }')) {
  code = code.replace(
    "import { CeParser } from '../parsers/CeParser.js';",
    "import { CeParser } from '../parsers/CeParser.js';\nimport { SpParser } from '../parsers/SpParser.js';\nimport { RsParser } from '../parsers/RsParser.js';"
  );
}

code = code.replace(
  "      } else if (job.sourceId === 'SSP-RS') {\n        const parser = new RsParser();\n        result = await parser.process(job.id, job.rawFilePath, job.datasetId);\n        throw new Error(`Nenhum parser configurado para a origem: ${job.sourceId}`);\n      }",
  "      } else if (job.sourceId === 'SSP-RS') {\n        const parser = new RsParser();\n        result = await parser.process(job.id, job.rawFilePath, job.datasetId);\n      } else {\n        throw new Error(`Nenhum parser configurado para a origem: ${job.sourceId}`);\n      }"
);

fs.writeFileSync('src/ingestion/pipeline/IngestionWorker.ts', code);
