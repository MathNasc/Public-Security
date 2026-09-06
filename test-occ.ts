import { db } from './src/db/index.js';
import { securityOccurrences } from './src/db/schema.js';

async function run() {
  await db.query.securityOccurrences.findMany({
    where: (occ, { eq }) => {
      console.log("occ.sourceId:", occ.sourceId);
      console.log("occ.sourceRecordId:", occ.sourceRecordId);
      return eq(occ.sourceId, "test");
    }
  }).catch(e => console.log("Error:", e.message));
}
run();
