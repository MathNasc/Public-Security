import { db } from './src/db/index.js';
import { dataImports, securityOccurrences, securityIndicators, sourceRegistry } from './src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function run() {
  const imports = await db.select().from(dataImports).where(eq(dataImports.status, 'completed'));
  
  for (const imp of imports) {
    const source = await db.select().from(sourceRegistry).where(eq(sourceRegistry.id, imp.sourceId)).then(res => res[0]);
    
    const countOcc = await db.select({ count: sql<number>`count(*)` }).from(securityOccurrences).where(eq(securityOccurrences.sourceId, imp.sourceId)).then(res => res[0].count);
    const countInd = await db.select({ count: sql<number>`count(*)` }).from(securityIndicators).where(eq(securityIndicators.sourceId, imp.sourceId)).then(res => res[0].count);
    const totalValid = countOcc + countInd;
    
    // Período coberto:
    let minPeriod = '', maxPeriod = '';
    if (countOcc > 0) {
      minPeriod = await db.select({ p: sql<string>`min(year || '-' || printf('%02d', month))` }).from(securityOccurrences).where(eq(securityOccurrences.sourceId, imp.sourceId)).then(res => res[0].p);
      maxPeriod = await db.select({ p: sql<string>`max(year || '-' || printf('%02d', month))` }).from(securityOccurrences).where(eq(securityOccurrences.sourceId, imp.sourceId)).then(res => res[0].p);
    } else if (countInd > 0) {
      minPeriod = await db.select({ p: sql<string>`min(period)` }).from(securityIndicators).where(eq(securityIndicators.sourceId, imp.sourceId)).then(res => res[0].p);
      maxPeriod = await db.select({ p: sql<string>`max(period)` }).from(securityIndicators).where(eq(securityIndicators.sourceId, imp.sourceId)).then(res => res[0].p);
    }
    
    console.log(`\n=== RELATÓRIO: ${imp.sourceId} ===`);
    console.log(`1. Nome exato do arquivo: ${imp.originalFilename}`);
    console.log(`2. URL oficial de origem: ${source?.officialPage || 'N/A'}`);
    console.log(`3. URL final de download: ${source?.finalDownloadUrl || source?.downloadUrl || 'N/A'}`);
    console.log(`4. Data de coleta: ${imp.startedAt}`);
    console.log(`5. SHA-256: ${imp.checksum}`);
    console.log(`6. Tamanho: ${imp.fileSize} bytes`);
    console.log(`7. Formato e encoding: ${source?.fileFormat || 'unknown'}`);
    console.log(`8. Período coberto: ${minPeriod} a ${maxPeriod}`);
    console.log(`9. Abrangência geográfica: ${source?.state || 'BR'}`);
    console.log(`10. Granularidade: ${source?.granularity || 'N/A'}`);
    console.log(`11. Quantidade de linhas lidas: ${imp.recordsParsed}`);
    console.log(`12. Quantidade de registros válidos criados: ${totalValid}`);
  }
  process.exit(0);
}
run();
