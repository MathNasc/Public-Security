const fs = require('fs');
let code = fs.readFileSync('src/ingestion/parsers/BaParser.ts', 'utf8');

code = code.replace(
/for \(let i = 0; i < valNum; i\+\+\) \{\s*batch\.push\(\{[\s\S]*?\}\);\s*\}/g,
`for (let i = 0; i < valNum; i++) {
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
                  }`
);

code = code.replace(/if \(batch\.length >= 40\) \{\s*await db\.insert\(securityOccurrences\)\.values\(batch\);\s*recordsProcessed \+= batch\.length;\s*batch = \[\];\s*\}/, "");

fs.writeFileSync('src/ingestion/parsers/BaParser.ts', code);
console.log("Patched");
