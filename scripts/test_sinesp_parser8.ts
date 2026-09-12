import { db } from '../src/db/index.js';
import { securityOccurrences } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';

async function run() {
  const result = await db.select({ count: sql<number>`count(*)` }).from(securityOccurrences).where(eq(securityOccurrences.sourceId, 'SINESP'));
  console.log(`Total occurrences from SINESP: ${result[0].count}`);
}
run();
