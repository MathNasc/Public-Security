import { db } from './src/db/index.js';
import { geographicMunicipalities } from './src/db/schema.js';
import { sql } from 'drizzle-orm';

async function main() {
  const count = await db.select({ count: sql`count(*)` }).from(geographicMunicipalities);
  console.log("Municipalities count:", count[0].count);
  process.exit(0);
}
main();
