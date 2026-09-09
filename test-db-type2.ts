import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  const res = await db.execute(sql`
    SELECT * FROM geometry_columns WHERE f_table_name = 'geographic_states';
  `);
  console.log(res);
  process.exit(0);
}
main();
