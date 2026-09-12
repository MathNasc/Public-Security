import { db } from '../src/db/index.js';
import { securityOccurrences } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function run() {
  const result = await db.select().from(securityOccurrences).limit(1);
  console.log(result);
}
run();
