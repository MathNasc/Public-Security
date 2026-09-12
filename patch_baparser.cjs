const fs = require('fs');
let code = fs.readFileSync('src/ingestion/parsers/BaParser.ts', 'utf8');

const target = `            for (const crime of crimes) {
               const valNum = parseInt(String(crime.val || '0').replace(/\\D/g, ''));
               if (valNum > 0) {
                  // We simulate multiple records or just one record with value count?
                  // For occurrences, we create valNum rows if it's microdata format, 
                  // but for aggregate we can insert individual rows to preserve count.
                  for (let i = 0; i < valNum; i++) {
                     batch.push({
                        id: crypto.randomUUID(),
                        sourceId: 'SSP-BA',
                        datasetId,
                        stateCode: 'BA',
                        municipalityName: String(muni).toUpperCase(),
                        category: crime.cat,
                        sourceCategory: crime.col,
                        occurredAt: new Date(2024, 0, 1), // Simplification for aggregate if year not in row
                        year: 2024,
                        month: 1,
                        createdAt: new Date(),
                        updatedAt: new Date()
                     });
                  }
               }
            }
            if (batch.length >= 40) {
               await db.insert(securityOccurrences).values(batch);
               recordsProcessed += batch.length;
               batch = [];
            }`;

const repl = `            for (const crime of crimes) {
               const valNum = parseInt(String(crime.val || '0').replace(/\\D/g, ''));
               if (valNum > 0) {
                  for (let i = 0; i < valNum; i++) {
                     batch.push({
                        id: crypto.randomUUID(),
                        sourceId: 'SSP-BA',
                        datasetId,
                        stateCode: 'BA',
                        municipalityName: String(muni).toUpperCase(),
                        category: crime.cat,
                        sourceCategory: crime.col,
                        occurredAt: new Date(2024, 0, 1), 
                        year: 2024,
                        month: 1,
                        createdAt: new Date(),
                        updatedAt: new Date()
                     });
                     if (batch.length >= 40) {
                        await db.insert(securityOccurrences).values(batch);
                        recordsProcessed += batch.length;
                        batch = [];
                     }
                  }
               }
            }`;

if (code.includes(target)) {
   code = code.replace(target, repl);
   fs.writeFileSync('src/ingestion/parsers/BaParser.ts', code);
   console.log("Patched BaParser");
} else {
   console.log("Target not found");
}
