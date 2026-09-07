import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/logger\.error\("Internal Analysis Error", \{ event: "analysis_error", error: err.message \}\);/g, 
'logger.error("Internal Analysis Error", { event: "analysis_error", error: err.stack || err.message }); console.error("DEBUG:", err.stack);');

fs.writeFileSync('server.ts', code);
