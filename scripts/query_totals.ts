import { db } from '../src/db/index.js';
import { securityOccurrences } from '../src/db/schema.js';
import { sql } from 'drizzle-orm';

async function run() {
  const result = await db.select({
    sourceId: securityOccurrences.sourceId,
    count: sql<number>`count(*)`
  }).from(securityOccurrences).groupBy(securityOccurrences.sourceId);
  
  console.log(`\n=== ESTATÍSTICAS DO RAW STORAGE (INGESTION PIPELINE) ===`);
  for (const r of result) {
    console.log(`Origem: ${r.sourceId} | Linhas processadas: ${r.count}`);
  }
}
run();
