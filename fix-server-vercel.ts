import fs from 'fs';

const filePath = 'server.ts';
let code = fs.readFileSync(filePath, 'utf8');

// Export the app instance so api/index.ts can use it
if (!code.includes('export default app;')) {
    code = code.replace('const app = express();', 'export const app = express();\nexport default app;');
    // We only want to start the server automatically if it is NOT running inside Vercel
    // Vercel handles the listening part for serverless functions
    code = code.replace(/app\.listen\(PORT(.*?)\);/gs, `
    if (process.env.VERCEL !== "1") {
      app.listen(PORT, "0.0.0.0", () => {
        logger.info(\`Server running on port \${PORT}\`, { event: "server_start", port: PORT });
      });
    }
    `);
    
    // We need to wrap startServer call
    code = code.replace('startServer();', `
if (process.env.VERCEL !== "1") {
  startServer();
} else {
  // If in vercel, we just run the setup synchronously as much as possible, or Vercel will handle it
  // Actually, Vercel needs the app exported synchronously.
}
`);

    fs.writeFileSync(filePath, code);
}
