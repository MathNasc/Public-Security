import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  await db.execute(sql`
    ALTER TABLE geographic_states ALTER COLUMN geom TYPE geometry(MultiPolygon, 4326);
    ALTER TABLE geographic_municipalities ALTER COLUMN geom TYPE geometry(MultiPolygon, 4326);
  `);
  console.log("Altered types to MultiPolygon 4326");
  process.exit(0);
}
main();
