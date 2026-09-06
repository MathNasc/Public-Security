const fs = require('fs');
let code = fs.readFileSync('src/services/DataIngestionService.ts', 'utf-8');

const regexQuery = /columns:\s*\{\s*sourceId:\s*true\s*\},[\s\S]*?where:\s*\(occ,\s*\{\s*eq,\s*and,\s*inArray\s*\}\)\s*=>\s*and\([\s\S]*?eq\(occ\.source,\s*sourceName\),[\s\S]*?inArray\(occ\.sourceId,\s*sourceIds\)[\s\S]*?\)[\s\S]*?\}\);/;
const replacementQuery = `columns: { sourceRecordId: true },
        where: (occ, { eq, and, inArray }) => and(
          eq(occ.sourceId, sourceName),
          inArray(occ.sourceRecordId, sourceIds)
        )
      });`;

code = code.replace(regexQuery, replacementQuery);

code = code.replace('const existingIds = new Set(existing.map(e => e.sourceId));', 'const existingIds = new Set(existing.map(e => e.sourceRecordId));');

const oldValues = `id: crypto.randomUUID(),
          source: sourceName,
          sourceId: r.source_record_id,
          category: r.category,`;
const newValues = `id: crypto.randomUUID(),
          sourceId: sourceName,
          sourceRecordId: r.source_record_id,
          category: r.category,`;
code = code.replace(oldValues, newValues);

code = code.replace(/importBatchId:\s*batchId,\s*/g, '');

fs.writeFileSync('src/services/DataIngestionService.ts', code);
console.log("Patched successfully");
