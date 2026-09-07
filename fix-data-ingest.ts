import fs from 'fs';
let code = fs.readFileSync('src/services/DataIngestionService.ts', 'utf8');

code = code.replace(
  'recordsImported: (existingSource.recordsImported || 0) + stats.valid_records,\n        status: "Ativo",\n      })',
  'recordsImported: (existingSource.recordsImported || 0) + stats.valid_records,\n        status: "Ativo",\n        updatedAt: new Date()\n      })'
);

code = code.replace(
  'recordsImported: stats.valid_records,\n        status: "Ativo",\n      });',
  'recordsImported: stats.valid_records,\n        status: "Ativo",\n        createdAt: new Date(),\n        updatedAt: new Date()\n      });'
);

fs.writeFileSync('src/services/DataIngestionService.ts', code);
