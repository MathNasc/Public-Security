import { db } from '../src/db/index.js';
import { dataImports } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function run() {
  await db.update(dataImports)
    .set({ status: 'pending' })
    .where(eq(dataImports.sourceId, 'SINESP'));
  console.log('Reset SINESP jobs to pending.');
}
run();
