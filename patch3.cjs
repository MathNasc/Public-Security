const fs = require('fs');
const file = 'src/services/DataIngestionService.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  "await db.insert(securityOccurrences).values(valuesToInsert);",
  "await db.insert(securityOccurrences).values(valuesToInsert).onConflictDoNothing({ target: [securityOccurrences.sourceId, securityOccurrences.sourceRecordId] });"
);
fs.writeFileSync(file, content);
