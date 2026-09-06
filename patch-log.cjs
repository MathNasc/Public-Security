const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const logStatement = `\napp._router.stack.forEach(function(r){\n  if (r.route && r.route.path){\n    console.log(r.route.path)\n  } else if (r.name === 'router') {\n    console.log('Router mounted at', r.regexp);\n  }\n});\n`;

code = code.replace(/app\.listen\(PORT/, logStatement + '\n  app.listen(PORT');
fs.writeFileSync('server.ts', code);
