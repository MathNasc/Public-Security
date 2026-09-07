import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function run() {
  const occurrencesResult = await db.execute(sql`SELECT count(*) FROM security_occurrences`);
  const occurrencesCount = occurrencesResult[0]?.count;

  const indicatorsResult = await db.execute(sql`SELECT count(*) FROM security_indicators`);
  const indicatorsCount = indicatorsResult[0]?.count;

  console.log(`security_occurrences: ${occurrencesCount}`);
  console.log(`security_indicators: ${indicatorsCount}`);

  const sizes = await db.execute(sql`
    SELECT
        relname AS "table_name",
        pg_size_pretty(pg_total_relation_size(relid)) AS "total_size",
        pg_size_pretty(pg_relation_size(relid)) AS "data_size",
        pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS "index_size"
    FROM pg_catalog.pg_statio_user_tables
    ORDER BY pg_total_relation_size(relid) DESC;
  `);
  console.table(sizes);
}

run().catch(console.error).then(() => process.exit(0));
