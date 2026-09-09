import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

// The Vercel regex replacement added an extra closing bracket or missed one
const endRegex = /app\.listen\(PORT, "0\.0\.0\.0", \(\) => \{\s*logger\.info\(`Server running on port \$\{PORT\}`\, \{ event: "server_start", port: PORT \}\);\s*\}\);\s*\}\s*\}/gs;

// Clean up the ending of server.ts
code = code.replace(/    if \(process\.env\.VERCEL !== "1"\) \{\s*app\.listen\(PORT, "0\.0\.0\.0", \(\) => \{\s*logger\.info\(`Server running on port \$\{PORT\}`\, \{ event: "server_start", port: PORT \}\);\s*\}\);\s*\}\s*\}/g, 
`    if (process.env.VERCEL !== "1") {
      app.listen(PORT, "0.0.0.0", () => {
        logger.info(\`Server running on port \${PORT}\`, { event: "server_start", port: PORT });
      });
    }
}`);

fs.writeFileSync('server.ts', code);
