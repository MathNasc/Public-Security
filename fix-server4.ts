import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

// Strip all drizzle imports from server.ts
code = code.replace(/import \{.*\} from 'drizzle-orm';\n/g, '');
code = code.replace(/import \{.*\} from "drizzle-orm";\n/g, '');

// Re-add a single unified import
const unifiedImport = `import { eq, and, gte, lte, asc, sql, isNotNull, isNull, desc } from "drizzle-orm";\n`;
code = unifiedImport + code;

fs.writeFileSync('server.ts', code);
