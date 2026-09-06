const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf-8');

const newFunctions = `
  const triggerEngine = async (engineName, endpoint) => {
    setIsUploading(true);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (e) {
      alert('Falha de rede.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadSample = async () => {
`;

code = code.replace(/const handleDownloadSample = async \(\) => {/, newFunctions);

const newButtons = `
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <button 
              onClick={() => triggerEngine('IBGE', '/api/admin/run-engine/ibge')}
              disabled={isUploading}
              className="px-4 py-2 bg-blue-900/50 hover:bg-blue-800/60 border border-blue-700/50 text-blue-200 font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Database className="w-4 h-4" />
              Sincronizar IBGE (Geografia)
            </button>
            <button 
              onClick={() => triggerEngine('SSP-SP', '/api/admin/run-engine/ssp')}
              disabled={isUploading}
              className="px-4 py-2 bg-green-900/50 hover:bg-green-800/60 border border-green-700/50 text-green-200 font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Database className="w-4 h-4" />
              Ingerir SSP-SP (Background)
            </button>
          </div>
        </div>
`;

code = code.replace(/<\/div>\s*<\/div>\s*<div className="bg-slate-900\/80/, newButtons + '\n        <div className="bg-slate-900/80');

fs.writeFileSync('src/pages/Admin.tsx', code);
console.log("Patched Admin buttons");
