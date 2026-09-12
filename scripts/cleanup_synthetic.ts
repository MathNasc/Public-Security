import { db } from '../src/db/index.js';
import { securityOccurrences, dataImports } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function run() {
  const allOccurrences = await db.select({ id: securityOccurrences.id, isSyntheticPoint: securityOccurrences.isSyntheticPoint, sourceId: securityOccurrences.sourceId }).from(securityOccurrences);
  console.log(`Total occurrences: ${allOccurrences.length}`);
  const syntheticCount = allOccurrences.filter(o => o.isSyntheticPoint || o.sourceId === 'MOCK' || o.sourceId === 'TEST').length;
  console.log(`Synthetic occurrences found: ${syntheticCount}`);
  
  if (syntheticCount > 0) {
    await db.delete(securityOccurrences).where(eq(securityOccurrences.isSyntheticPoint, true));
    await db.delete(securityOccurrences).where(eq(securityOccurrences.sourceId, 'MOCK'));
    await db.delete(securityOccurrences).where(eq(securityOccurrences.sourceId, 'TEST'));
    console.log('Synthetic data deleted.');
  } else {
    // If we have fake data that doesn't have isSyntheticPoint=true, let's just wipe the tables to be clean for production.
    // Wait, ISP-RJ and BA might have been downloaded just now.
    // Let's check sourceIds.
    const sources = [...new Set(allOccurrences.map(o => o.sourceId))];
    console.log(`Present sourceIds: ${sources.join(', ')}`);
  }
}
run();
