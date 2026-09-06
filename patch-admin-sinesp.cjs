const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf-8');

const sspButton = `<button 
              onClick={() => triggerEngine('SSP-SP', '/api/admin/run-engine/ssp')}
              disabled={isUploading}
              className="px-4 py-2 bg-green-900/50 hover:bg-green-800/60 border border-green-700/50 text-green-200 font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Database className="w-4 h-4" />
              Ingerir SSP-SP (Background)
            </button>`;

const sinespButton = `
            <button 
              onClick={() => triggerEngine('SINESP', '/api/admin/run-engine/sinesp')}
              disabled={isUploading}
              className="px-4 py-2 bg-purple-900/50 hover:bg-purple-800/60 border border-purple-700/50 text-purple-200 font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Database className="w-4 h-4" />
              Ingerir SINESP (Nacional)
            </button>
`;

if (!code.includes('Ingerir SINESP')) {
    code = code.replace(sspButton, sspButton + '\\n' + sinespButton);
    fs.writeFileSync('src/pages/Admin.tsx', code);
    console.log("Patched Admin UI with SINESP button");
}
