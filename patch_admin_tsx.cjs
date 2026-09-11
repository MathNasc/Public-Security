const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

code = code.replace(
  /const response = await fetch\("\/api\/admin\/download-sample", \{ method: "POST" \}\);/,
  `const response = await fetch("/api/admin/automation/trigger-all", { method: "POST", headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } });`
);

code = code.replace(
  /Baixar Amostra Real SSP \(Web\)/,
  `Rodar Automação Completa (Crawler Todos os Estados)`
);

code = code.replace(
  /alert\(\`Sucesso! \$\{data\.inserted\} registros da amostra real foram importados\.\`\);/,
  `alert(data.message || "Automação iniciada com sucesso!");`
);

fs.writeFileSync('src/pages/Admin.tsx', code);
