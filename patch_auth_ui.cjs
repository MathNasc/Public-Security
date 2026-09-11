const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// Also inject the token logic when clicking the button on UI
code = code.replace(
  /const response = await fetch\("\/api\/admin\/automation\/trigger-all", \{ method: "POST", headers: \{ 'Authorization': 'Bearer ' \+ localStorage\.getItem\('token'\) \} \}\);/,
  `
      const token = prompt("Insira a senha de Admin (ADMIN_SECRET):");
      if (!token) {
        setIsUploading(false);
        return;
      }
      
      const response = await fetch("/api/admin/automation/trigger-all", { 
        method: "POST", 
        headers: { 'Authorization': \`Bearer \${token}\` } 
      });
  `
);
fs.writeFileSync('src/pages/Admin.tsx', code);
