import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

// If the app is initialized inside a function, Vercel cannot import it synchronously.
// We must extract route definitions outside of the async startServer() function, or export an already initialized app.
// Since Vercel uses serverless functions, we can just instantiate `const app = express()` at the top layer
// and attach the routes there.

if (code.includes('async function startServer()')) {
  // Too complex to regex reliably, we will just construct a cleaner api/index.ts that imports and runs setup
}
