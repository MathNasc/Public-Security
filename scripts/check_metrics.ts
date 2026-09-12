import { db } from '../src/db/index.js';
import { securityOccurrences, securityIndicators, dataImports } from '../src/db/schema.js';
import { sql } from 'drizzle-orm';

async function run() {
  const imports = await db.select().from(dataImports);
  const occs = await db.select({
    sourceId: securityOccurrences.sourceId,
    count: sql<number>`count(*)`
  }).from(securityOccurrences).groupBy(securityOccurrences.sourceId);
  
  const inds = await db.select({
    sourceId: securityIndicators.sourceId,
    count: sql<number>`count(*)`
  }).from(securityIndicators).groupBy(securityIndicators.sourceId);
  
  console.log('\n================ RESUMO E2E ===================');
  for (const imp of imports) {
    const occCount = occs.find(o => o.sourceId === imp.sourceId)?.count || 0;
    const indCount = inds.find(i => i.sourceId === imp.sourceId)?.count || 0;
    console.log(`Fonte: ${imp.sourceId} | Arquivo: ${imp.originalFilename} | Status: ${imp.status} | Processados: ${imp.recordsImported} | Occs: ${occCount} | Inds: ${indCount}`);
  }
  console.log('===============================================');
}
run();
