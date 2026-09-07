import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'const totalRecords = (await db.select({ count: sql`count(*)` }).from(securityOccurrences))[0].count;',
  'const totalRecords = Number((await db.select({ count: sql`count(*)` }).from(securityOccurrences))[0].count);'
);

code = code.replace(
  'const withCoords = (await db.select({ count: sql`count(*)` }).from(securityOccurrences).where(isNotNull(securityOccurrences.latitude)))[0].count;',
  'const withCoords = Number((await db.select({ count: sql`count(*)` }).from(securityOccurrences).where(isNotNull(securityOccurrences.latitude)))[0].count);'
);

code = code.replace(
  'const oldestDate = oldestDateRow[0]?.minDate ? new Date(oldestDateRow[0].minDate).toISOString() : null;',
  'const oldestDate = oldestDateRow[0]?.minDate ? new Date(oldestDateRow[0].minDate as string).toISOString() : null;'
);

code = code.replace(
  'const newestDate = newestDateRow[0]?.maxDate ? new Date(newestDateRow[0].maxDate).toISOString() : null;',
  'const newestDate = newestDateRow[0]?.maxDate ? new Date(newestDateRow[0].maxDate as string).toISOString() : null;'
);

fs.writeFileSync('server.ts', code);
