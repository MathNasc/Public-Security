const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const syncEndpoint = `
import { exec } from 'child_process';

app.post("/api/admin/force-db-sync", adminAuth, (req, res) => {
  exec("npx drizzle-kit push", (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: error.message, stdout, stderr });
    }
    res.json({ success: true, stdout, stderr });
  });
});
`;

if (!code.includes('/api/admin/force-db-sync')) {
  // inject after other admin endpoints
  code = code.replace(
    /app\.post\("\/api\/admin\/automation\/trigger-all",/,
    `app.post("/api/admin/force-db-sync", adminAuth, (req, res) => {
  const { exec } = require('child_process');
  exec("npx drizzle-kit push", { env: process.env }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: error.message, stdout, stderr });
    }
    res.json({ success: true, stdout, stderr });
  });
});\n\napp.post("/api/admin/automation/trigger-all",`
  );
  fs.writeFileSync('server.ts', code);
}
