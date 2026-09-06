import { db } from './src/db/index.js';
import { securityOccurrences } from './src/db/schema.js';

async function run() {
  try {
    await db.query.securityOccurrences.findMany({
      columns: { sourceRecordId: true },
      where: (occ, { eq, and, inArray }) => and(
        eq(occ.sourceId, "test"),
        inArray(occ.sourceRecordId, ["a", "b"])
      )
    });
    console.log("Query ran successfully");
  } catch (e: any) {
    console.log("ERROR:", e.message);
  }
}
run();
