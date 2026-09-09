import { db } from './src/db/index.js';
import { dataSources, securityOccurrences, dataImports } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  console.log("Cleaning up test data...");
  await db.delete(securityOccurrences).where(eq(securityOccurrences.sourceId, 'Test'));
  await db.delete(securityOccurrences).where(eq(securityOccurrences.sourceId, 'SSP-SP'));
  await db.delete(dataSources).where(eq(dataSources.name, 'SSP-SP'));
  await db.delete(dataImports).where(eq(dataImports.sourceId, 'SSP-SP'));
  console.log("Cleanup done.");
  process.exit(0);
}
main();
