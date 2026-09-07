import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

// The ultimate deduplicator
const lines = code.split('\n');
const seenImports = new Set();
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('import ') && line.includes('drizzle-orm')) {
    if (!seenImports.has('drizzle-orm')) {
      newLines.push('import { eq, and, gte, lte, asc, sql, isNotNull, isNull, desc } from "drizzle-orm";');
      seenImports.add('drizzle-orm');
    }
  } else if (line.startsWith('import ') && line.includes('src/db/schema.js')) {
    if (!seenImports.has('src/db/schema.js')) {
      newLines.push("import { dataSources, dataImports, securityOccurrences, securityIndicators, geographicStates, geographicMunicipalities, ingestionJobs, dataDatasets, rawStorage } from './src/db/schema.js';");
      seenImports.add('src/db/schema.js');
    }
  } else if (line.startsWith('import ') && line.includes('src/db/index.js')) {
    if (!seenImports.has('src/db/index.js')) {
      newLines.push(line);
      seenImports.add('src/db/index.js');
    }
  } else {
    newLines.push(line);
  }
}

fs.writeFileSync('server.ts', newLines.join('\n'));
