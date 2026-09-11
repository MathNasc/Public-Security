const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  /\$\{jobs\} fontes foram processadas \(downloads \+ importações agendadas\)\. O Worker está inserindo os dados no PostGIS em background\./,
  "${jobs} fontes verificadas com sucesso! Status dos Links Oficiais atualizados."
);
fs.writeFileSync('server.ts', code);
