const fs = require('fs');
const file = 'src/services/DataIngestionService.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  "sourceInfo: { provider: string, url: string, description: string, coverage: string, filename?: string }",
  "sourceInfo: { provider: string, url: string, description: string, coverage: string, filename?: string, batchId?: string }"
);
content = content.replace(
  "const batchId = crypto.randomUUID();",
  "const batchId = sourceInfo.batchId || crypto.randomUUID();"
);
content = content.replace(
  "await db.insert(dataImports).values({",
  `const existingBatch = await db.query.dataImports.findFirst({ where: (di, { eq }) => eq(di.id, batchId) });
    if (existingBatch) {
      await db.update(dataImports).set({
        recordsInserted: (existingBatch.recordsInserted || 0) + stats.valid_records,
        recordsRejected: (existingBatch.recordsRejected || 0) + stats.rejected_records,
        finishedAt: new Date()
      }).where(eq(dataImports.id, batchId));
    } else {
      await db.insert(dataImports).values({`
);
content = content.replace(
  "createdAt: new Date(),\n    });",
  "createdAt: new Date(),\n    });\n    }"
);
fs.writeFileSync(file, content);
