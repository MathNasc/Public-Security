import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("Clearing SINESP fake data...");
  const res = await db.execute(sql`DELETE FROM security_indicators WHERE source_id = 'SINESP'`);
  console.log("Fake data cleared.");
}
main();
