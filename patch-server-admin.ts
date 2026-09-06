import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf-8');

// Insert new admin endpoint for data quality
const dataQualityEndpoint = `
app.get("/api/admin/data-quality", async (req, res) => {
  try {
    // Basic stats
    const totalRecords = (await db.select({ count: sql<number>\`count(*)\` }).from(occurrences))[0].count;
    
    // Coordinates
    const withCoords = (await db.select({ count: sql<number>\`count(*)\` }).from(occurrences).where(isNotNull(occurrences.latitude)))[0].count;
    const withoutCoords = totalRecords - withCoords;
    
    // Geocoding status
    const geocoded = (await db.select({ count: sql<number>\`count(*)\` }).from(occurrences).where(eq(occurrences.geocodingStatus, 'geocoded')))[0].count;
    const geoFailed = (await db.select({ count: sql<number>\`count(*)\` }).from(occurrences).where(eq(occurrences.geocodingStatus, 'failed')))[0].count;
    const notEnoughData = (await db.select({ count: sql<number>\`count(*)\` }).from(occurrences).where(eq(occurrences.geocodingStatus, 'not_enough_data')))[0].count;
    
    // Dates
    const oldestDateRow = await db.select({ minDate: sql<number>\`min(occurred_at)\` }).from(occurrences).where(isNotNull(occurrences.occurredAt));
    const newestDateRow = await db.select({ maxDate: sql<number>\`max(occurred_at)\` }).from(occurrences).where(isNotNull(occurrences.occurredAt));
    const oldestDate = oldestDateRow[0]?.minDate ? new Date(oldestDateRow[0].minDate).toISOString() : null;
    const newestDate = newestDateRow[0]?.maxDate ? new Date(newestDateRow[0].maxDate).toISOString() : null;
    
    const withoutDate = (await db.select({ count: sql<number>\`count(*)\` }).from(occurrences).where(isNull(occurrences.occurredAt)))[0].count;
    
    // Categories
    const categoriesRows = await db.select({
      category: occurrences.category,
      count: sql<number>\`count(*)\`
    }).from(occurrences).groupBy(occurrences.category);
    
    // Batches
    const batches = await db.select().from(importBatches).orderBy(desc(importBatches.startedAt)).limit(10);
    
    res.json({
      coverage: {
        total: totalRecords,
        withCoordinates: withCoords,
        withoutCoordinates: withoutCoords,
        geocoded: geocoded,
        failedGeocoding: geoFailed,
        notEnoughData: notEnoughData
      },
      temporal: {
        oldest: oldestDate,
        newest: newestDate,
        withoutDate: withoutDate
      },
      categories: categoriesRows,
      recentBatches: batches
    });
  } catch (error) {
    console.error("Error fetching data quality:", error);
    res.status(500).json({ error: "Failed to fetch data quality" });
  }
});
`;

if (!code.includes('/api/admin/data-quality')) {
  // Need to import isNotNull, isNull from drizzle-orm if not already there
  if (!code.includes('isNotNull')) {
    code = code.replace(/import {([^}]+)} from "drizzle-orm";/, (match, group1) => {
      let vars = group1.split(',').map(s => s.trim());
      if (!vars.includes('isNotNull')) vars.push('isNotNull');
      if (!vars.includes('isNull')) vars.push('isNull');
      if (!vars.includes('desc')) vars.push('desc');
      return \`import { \${vars.join(', ')} } from "drizzle-orm";\`;
    });
  }
  
  // Need to import importBatches
  if (!code.includes('importBatches')) {
    code = code.replace(/import {([^}]+)} from "\.\/src\/db\/schema\.js";/, (match, group1) => {
      let vars = group1.split(',').map(s => s.trim());
      if (!vars.includes('importBatches')) vars.push('importBatches');
      return \`import { \${vars.join(', ')} } from "./src/db/schema.js";\`;
    });
  }

  code = code.replace('app.get("/api/health"', dataQualityEndpoint + '\napp.get("/api/health"');
  fs.writeFileSync('server.ts', code);
  console.log("Patched server.ts with data quality endpoint");
}
