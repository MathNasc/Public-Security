import fs from 'fs';

function applyFix(filePath: string) {
  let code = fs.readFileSync(filePath, 'utf8');
  
  const fixCode = `
// Auto-fix URL encoding issues for passwords with special chars
if (connectionString && connectionString.startsWith("postgres")) {
  const match = connectionString.match(/:\\/\\/(.*?):(.*?)@/);
  if (match && match[2]) {
    let rawPassword = match[2];
    if (rawPassword.includes('#') || (rawPassword.match(/@/g) || []).length > 0) {
      // Decode first in case it's partially encoded, then encode
      try {
        const decoded = decodeURIComponent(rawPassword);
        const encodedPassword = encodeURIComponent(decoded);
        connectionString = connectionString.replace(\`:\${rawPassword}@\`, \`:\${encodedPassword}@\`);
      } catch (e) {
        const encodedPassword = encodeURIComponent(rawPassword);
        connectionString = connectionString.replace(\`:\${rawPassword}@\`, \`:\${encodedPassword}@\`);
      }
    }
  }
}
`;
  
  if (code.includes('export const queryClient = postgres(connectionString);')) {
      code = code.replace('export const queryClient = postgres(connectionString);', fixCode + '\nexport const queryClient = postgres(connectionString);');
      fs.writeFileSync(filePath, code);
  } else if (code.includes('const queryClient = postgres(connectionString')) {
      code = code.replace('const queryClient = postgres(connectionString', fixCode + '\nconst queryClient = postgres(connectionString');
      fs.writeFileSync(filePath, code);
  }
}

applyFix('src/db/index.ts');
applyFix('src/db/migrate.ts');
