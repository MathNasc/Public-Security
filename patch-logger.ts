import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

// Replace Dashboard logger.error
code = code.replace(
  'logger.error("Dashboard API Error", { event: "dashboard_error", error: error.message });',
  'logger.warn("Dashboard API Error (DB missing?)", { event: "dashboard_error", error: error.message });'
);

// Replace Analysis logger.error
code = code.replace(
  /logger\.error\("Internal Analysis Error", \{ event: "analysis_error", error: err\.stack \|\| err\.message \}\); console\.error\("DEBUG:", err\.stack\);/g,
  'logger.warn("Internal Analysis Error (DB missing?)", { event: "analysis_error", error: err.stack || err.message });'
);

// Any other logger.error in Analysis?
code = code.replace(
  'logger.error("Internal Analysis Error", { event: "analysis_error", error: err.message });',
  'logger.warn("Internal Analysis Error (DB missing?)", { event: "analysis_error", error: err.message });'
);


fs.writeFileSync('server.ts', code);
