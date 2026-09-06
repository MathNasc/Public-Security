import { db } from './src/db/index.js';
import { securityOccurrences } from './src/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

const query = db.query.securityOccurrences.findMany({
  columns: { sourceRecordId: true },
  where: (occ, { eq, and, inArray }) => and(
    eq(occ.sourceId, "test"),
    inArray(occ.sourceRecordId, ["a", "b"])
  )
});

console.log(query.toSQL());
