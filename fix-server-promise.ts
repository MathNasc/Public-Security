import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'await new Promise((resolve, reject) => {',
  'await new Promise<void>((resolve, reject) => {'
);
code = code.replace(
  'writer.on("finish", resolve);',
  'writer.on("finish", () => resolve());'
);

fs.writeFileSync('server.ts', code);
