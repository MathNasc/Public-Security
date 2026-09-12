const { db } = require('./src/db/index.js');
const { dataImports } = require('./src/db/schema.js');
async function run() {
  const imports = await db.select().from(dataImports);
  for (const imp of imports) {
     if (imp.status === 'failed') {
        console.log(`Failed job: ${imp.sourceId} - ${imp.originalFilename}, Error: ${imp.errorMessage}`);
     }
  }
}
run();
