import { db } from "./src/db/index.js";
import { occurrences } from "./src/db/schema.js";
import { sql } from "drizzle-orm";

async function main() {
  const res = await db.select({
    category: occurrences.category,
    count: sql<number>`count(*)`
  }).from(occurrences).groupBy(occurrences.category);
  console.log("Categories:", res);
  
  const resSub = await db.select({
    subcategory: occurrences.subcategory,
    count: sql<number>`count(*)`
  }).from(occurrences).groupBy(occurrences.subcategory).orderBy(sql`count(*) DESC`).limit(10);
  console.log("Subcategories:", resSub);
}
main();
