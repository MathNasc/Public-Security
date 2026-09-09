import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("Creating spatial indexes...");
  try {
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS geo_mun_geom_idx ON geographic_municipalities USING GIST (geom);
    `);
    console.log("Created index on geographic_municipalities.geom");
  } catch (e: any) { console.error(e.message); }

  try {
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS geo_states_geom_idx ON geographic_states USING GIST (geom);
    `);
    console.log("Created index on geographic_states.geom");
  } catch (e: any) { console.error(e.message); }

  try {
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS occ_geom_idx ON security_occurrences USING GIST (
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
      );
    `);
    console.log("Created index on security_occurrences coordinates");
  } catch (e: any) { console.error(e.message); }
  
  process.exit(0);
}
main();
