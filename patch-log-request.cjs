const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace("app.use(cors());", "app.use((req,res,next)=>{ console.log('REQ:', req.method, req.url); next(); });\napp.use(cors());");
fs.writeFileSync('server.ts', code);
