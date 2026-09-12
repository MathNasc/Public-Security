import { db } from '../src/db/index.js';
import { securityOccurrences } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function run() {
  const rj = await db.select().from(securityOccurrences).where(eq(securityOccurrences.sourceId, 'ISP-RJ')).limit(5);
  console.log(rj);
}
run();
