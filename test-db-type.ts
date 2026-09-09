import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  const res = await db.execute(sql`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name = 'geographic_states' AND column_name = 'geom';
  `);
  console.log(res);
  process.exit(0);
}
main();
