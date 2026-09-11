const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

const syncFunction = `
  const forceDbSync = async () => {
    setIsUploading(true);
    try {
      const token = prompt("Insira a senha de Admin (ADMIN_SECRET) para forçar o Sync do Banco:");
      if (!token) {
        setIsUploading(false);
        return;
      }
      
      const response = await fetch("/api/admin/force-db-sync", { 
        method: "POST", 
        headers: { 'Authorization': \`Bearer \${token}\` } 
      });
      const data = await response.json();
      
      if (response.ok) {
        alert("Sync finalizado!\\n\\nSTDOUT:\\n" + data.stdout + "\\n\\nSTDERR:\\n" + data.stderr);
        fetchSources();
      } else {
        alert("Erro no Sync:\\n" + data.error + "\\n\\nSTDOUT:\\n" + data.stdout + "\\n\\nSTDERR:\\n" + data.stderr);
      }
    } catch (err: any) {
      alert("Falha ao comunicar com o servidor: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };
`;

if (!code.includes('forceDbSync')) {
  code = code.replace(
    /const triggerCrawler = async/,
    syncFunction + '\n  const triggerCrawler = async'
  );
  
  const syncButton = `
            <button 
              onClick={forceDbSync}
              disabled={isUploading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-900 border border-purple-500 text-slate-100 font-semibold rounded-lg text-sm transition-colors w-full sm:w-auto text-center flex items-center justify-center gap-2 mt-4"
            >
              <Database className="w-4 h-4" />
              {isUploading ? "Processando..." : "Forçar Sincronização do Banco (DB Sync)"}
            </button>
  `;
  
  code = code.replace(
    /<\/button>\s*<div>\s*<input \s*type="file"/,
    '</button>\n' + syncButton + '\n            <div>\n              <input type="file"'
  );
}

fs.writeFileSync('src/pages/Admin.tsx', code);
