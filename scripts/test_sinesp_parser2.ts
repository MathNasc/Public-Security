import { db } from '../src/db/index.js';
import { securityOccurrences } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function run() {
  const result = await db.select().from(securityOccurrences).where(eq(securityOccurrences.sourceId, 'SINESP')).limit(10);
  console.log(`Found ${result.length} parsed occurrences from SINESP:`);
  console.log(result);
}
run();
