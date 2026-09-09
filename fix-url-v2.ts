import fs from 'fs';

function applyFix(filePath: string) {
  let code = fs.readFileSync(filePath, 'utf8');
  
  // Clean up the previous fix if any
  code = code.replace(/\/\/ Auto-fix URL encoding issues.*?(?=export const queryClient|const queryClient)/s, '');
  
  const fixCode = `
// Auto-fix URL encoding issues for passwords with special chars
if (connectionString && connectionString.startsWith("postgres")) {
  const parts = connectionString.split('@');
  if (parts.length > 1) {
    // There's an @ in the URL. We want the LAST @ to be the separator between credentials and host.
    // Anything before the last @ is "postgres:password" or similar.
    const lastAt = connectionString.lastIndexOf('@');
    const credentials = connectionString.substring(0, lastAt); // e.g. postgresql://postgres:ZaZd!@#8982
    const hostPart = connectionString.substring(lastAt); // e.g. @db.eykrzanfocirkbcbrbyp.supabase.co:5432/postgres
    
    const protoEnd = credentials.indexOf('://');
    if (protoEnd !== -1) {
       const proto = credentials.substring(0, protoEnd + 3);
       const auth = credentials.substring(protoEnd + 3); // postgres:ZaZd!@#8982
       const colonIndex = auth.indexOf(':');
       if (colonIndex !== -1) {
          const user = auth.substring(0, colonIndex);
          let pass = auth.substring(colonIndex + 1);
          
          if (pass.includes('#') || pass.includes('@')) {
             try { pass = decodeURIComponent(pass); } catch(e) {}
             pass = encodeURIComponent(pass);
             connectionString = proto + user + ':' + pass + hostPart;
          }
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
