import fs from 'fs';

const filePath = 'server.ts';
let code = fs.readFileSync(filePath, 'utf8');

if (!code.includes('export default app;')) {
  // Move const app = express(); outside startServer() so it can be exported
  code = code.replace(/async function startServer\(\) \{\n  const ingestionWorker = new IngestionWorker\(\);\n/s, 
    'export const app = express();\nexport default app;\n\nasync function startServer() {\n  const ingestionWorker = new IngestionWorker();\n');
  
  // Replace the inner const app = express() if it exists
  code = code.replace(/  const app = express\(\);\n/g, '');

  fs.writeFileSync(filePath, code);
}
