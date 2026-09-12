import { db } from '../src/db/index.js';
import { dataImports } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
async function run() {
  const jobs = await db.select().from(dataImports).where(eq(dataImports.id, '9c6cfbee-bb0f-4f92-bb54-071c0feb0c3f'));
  console.log(jobs[0].lastError);
}
run();
