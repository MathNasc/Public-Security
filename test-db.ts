import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function test() {
  try {
    const res = await db.execute(sql`SELECT postgis_full_version();`);
    console.log("PostGIS:", res);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
test();
