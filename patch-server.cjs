const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Patch 1: Period Parsing
code = code.replace(
  /let periodMonths = 12;\s*if \(period === "3m"\) periodMonths = 3;\s*if \(period === "6m"\) periodMonths = 6;\s*const cutoffDate = new Date\(\);\s*cutoffDate\.setMonth\(cutoffDate\.getMonth\(\) - periodMonths\);/g,
  `let periodMonths = 12;
  let cutoffDate = new Date();
  let endDate = new Date();
  let isSpecificYear = false;
  let isAllHistory = false;

  if (period === "3m") {
    periodMonths = 3;
    cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
  } else if (period === "6m") {
    periodMonths = 6;
    cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
  } else if (period === "12m") {
    periodMonths = 12;
    cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
  } else if (period === "all") {
    isAllHistory = true;
    periodMonths = 60; // 5 years baseline approx
    cutoffDate = new Date("2000-01-01T00:00:00Z");
  } else if (/^\\d{4}$/.test(period as string)) {
    isSpecificYear = true;
    periodMonths = 12;
    const year = parseInt(period as string, 10);
    cutoffDate = new Date(\`\${year}-01-01T00:00:00Z\`);
    endDate = new Date(\`\${year}-12-31T23:59:59.999Z\`);
  } else {
    cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
  }`
);

// Patch 2: DB Filtering
code = code.replace(
  /const rawOccurrences = await db\.select\(\)\.from\(occurrences\)\.where\(\s*and\(\s*gte\(occurrences\.latitude, bbox\.minLat\),\s*lte\(occurrences\.latitude, bbox\.maxLat\),\s*gte\(occurrences\.longitude, bbox\.minLon\),\s*lte\(occurrences\.longitude, bbox\.maxLon\),\s*gte\(occurrences\.occurredAt, cutoffDate\)\s*\)\s*\)\.orderBy\(asc\(occurrences\.occurredAt\)\);/g,
  `const dbConditions: any[] = [
      gte(occurrences.latitude, bbox.minLat),
      lte(occurrences.latitude, bbox.maxLat),
      gte(occurrences.longitude, bbox.minLon),
      lte(occurrences.longitude, bbox.maxLon),
      gte(occurrences.occurredAt, cutoffDate)
    ];
    if (isSpecificYear) {
      dbConditions.push(lte(occurrences.occurredAt, endDate));
    }

    const rawOccurrences = await db.select().from(occurrences).where(
      and(...dbConditions)
    ).orderBy(asc(occurrences.occurredAt));`
);

// Patch 3: Trend Map Calculation
code = code.replace(
  /\/\/ Fill missing months for trend\s*const trend = \[\];\s*for \(let i = periodMonths - 1; i >= 0; i--\) {\s*const d = new Date\(\);\s*d\.setMonth\(d\.getMonth\(\) - i\);\s*const k = \`\$\{d\.getFullYear\(\)\}-\$\{String\(d\.getMonth\(\) \+ 1\)\.padStart\(2, '0'\)\}\`;\s*trend\.push\(\{ month: k, count: trendMap\[k\] \|\| 0 \}\);\s*}/g,
  `// Fill missing months for trend
    const trend = [];
    if (isSpecificYear) {
      const year = parseInt(period as string, 10);
      for (let m = 1; m <= 12; m++) {
        const k = \`\${year}-\${String(m).padStart(2, '0')}\`;
        trend.push({ month: k, count: trendMap[k] || 0 });
      }
    } else if (isAllHistory) {
      const keys = Object.keys(trendMap).sort();
      for (const k of keys) {
        trend.push({ month: k, count: trendMap[k] });
      }
    } else {
      for (let i = periodMonths - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const k = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}\`;
        trend.push({ month: k, count: trendMap[k] || 0 });
      }
    }`
);

fs.writeFileSync('server.ts', code);
console.log('Patched server.ts successfully');
