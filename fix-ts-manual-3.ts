import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const lastLines = `    if (process.env.VERCEL !== "1") {
      app.listen(PORT, "0.0.0.0", () => {
        logger.info(\`Server running on port \${PORT}\`, { event: "server_start", port: PORT });
      });
    }
}

// Start Phase 10 Scheduler
if (process.env.NODE_ENV !== 'test') {
  globalScheduler.start(60000);
}
if (process.env.VERCEL !== "1") {
  startServer();
} else {
  // If in vercel, we just run the setup synchronously as much as possible, or Vercel will handle it
  // Actually, Vercel needs the app exported synchronously.
}`;

// Fix the file
const parts = code.split('    if (process.env.VERCEL !== "1") {');
code = parts[0] + lastLines;

fs.writeFileSync('server.ts', code);
