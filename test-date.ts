import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';
async function run() {
  const r1 = await db.execute(sql`SELECT COUNT(*) FROM security_occurrences WHERE occurred_at >= '2019-11-30' AND occurred_at <= '2019-12-31T23:59:59Z'`);
  const r2 = await db.execute(sql`SELECT COUNT(*) FROM security_occurrences`);
  console.log("Dec:", r1, "Total:", r2);
  process.exit(0);
}
run();
