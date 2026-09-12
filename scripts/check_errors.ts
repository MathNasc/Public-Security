import { db } from '../src/db/index.js';
import { dataImports } from '../src/db/schema.js';
async function run() {
  const imports = await db.select().from(dataImports);
  for (const imp of imports) {
     if (imp.status === 'failed') {
        console.log(`Failed job: ${imp.sourceId} - ${imp.originalFilename}, Error: ${imp.errorMessage}`);
     }
  }
}
run();
