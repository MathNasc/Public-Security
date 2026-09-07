import fs from 'fs';

// Patch server.ts
let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(
  'const app = express();',
  'const app = express();\napp.set("trust proxy", 1);'
);
fs.writeFileSync('server.ts', serverCode);

// Patch rateLimiter.ts
let rateLimiterCode = fs.readFileSync('src/middleware/rateLimiter.ts', 'utf8');
rateLimiterCode = rateLimiterCode.replace(
  /legacyHeaders: false,/g,
  'legacyHeaders: false,\n  validate: { xForwardedForHeader: false, trustProxy: false },'
);
fs.writeFileSync('src/middleware/rateLimiter.ts', rateLimiterCode);
