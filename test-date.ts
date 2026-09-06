import { db } from "./src/db/index.js";
import { occurrences } from "./src/db/schema.js";
import { sql, gte } from "drizzle-orm";

async function main() {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 12);
  const rows = await db.select({
    occurredAt: occurrences.occurredAt
  }).from(occurrences).where(gte(occurrences.occurredAt, cutoffDate)).limit(10);
  
  console.log(rows.map(r => r.occurredAt.toISOString()));
}
main();
