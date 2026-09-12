import { db } from '../src/db/index.js';
import { securityOccurrences } from '../src/db/schema.js';
import { eq, and, gte, lte, or, sql, isNull } from 'drizzle-orm';

async function run() {
  const start = new Date('2020-01-01');
  const end = new Date('2025-01-01');
  
  const results = await db.select({
    category: securityOccurrences.category,
    value: sql<number>`count(*)`
  })
  .from(securityOccurrences)
  .where(
    and(
      eq(securityOccurrences.sourceId, 'ISP-RJ'),
      eq(securityOccurrences.stateCode, 'RJ'),
      or(
        isNull(securityOccurrences.municipalityName),
        eq(securityOccurrences.municipalityName, 'Rio de Janeiro'),
        eq(securityOccurrences.municipalityName, '3304557')
      ),
      gte(securityOccurrences.occurredAt, start),
      lte(securityOccurrences.occurredAt, end)
    )
  )
  .groupBy(securityOccurrences.category);
  
  console.log('Results with query builder:', results);
}
run();
