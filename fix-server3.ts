import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

// The file might look like:
// import { eq, and, sql } from 'drizzle-orm';
// import { eq, desc, sql } from 'drizzle-orm';

code = code.replace(/import \{ eq, and, sql \} from 'drizzle-orm';\n/g, '');
code = code.replace(/import \{ and, sql \} from 'drizzle-orm';\n/g, '');

const properDrizzleImports = `import { eq, desc, sql, and } from 'drizzle-orm';\n`;
code = properDrizzleImports + code;

fs.writeFileSync('server.ts', code);
