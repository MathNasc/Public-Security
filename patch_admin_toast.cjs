const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// 1. Add X import for close button
code = code.replace(
  /import \{ ArrowUpRight, ShieldAlert, Activity/,
  'import { X, ArrowUpRight, ShieldAlert, Activity'
);

// 2. Add Toast state and component inside Admin
const toastState = `  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

`;

code = code.replace(
  /export default function Admin\(\) \{/,
  `export default function Admin() {\n${toastState}`
);

// 3. Replace all alert() with showToast()
code = code.replace(/alert\('Discovery disparado!'\)/g, "showToast('Discovery disparado!', 'success')");
code = code.replace(/alert\(\`Sucesso! \$\{data\.inserted\} registros importados do arquivo \$\{file\.name\}\.\`\)/g, "showToast(`Sucesso! ${data.inserted} registros importados do arquivo ${file.name}.`, 'success')");
code = code.replace(/alert\(\`Erro na importação: \$\{data\.error \|\| 'Desconhecido'\}\`\)/g, "showToast(`Erro na importação: ${data.error || 'Desconhecido'}`, 'error')");
code = code.replace(/alert\("Falha ao enviar arquivo\."\)/g, "showToast('Falha ao enviar arquivo.', 'error')");
code = code.replace(/alert\(data\.message\)/g, "showToast(data.message, 'success')");
code = code.replace(/alert\('Erro: ' \+ data\.error\)/g, "showToast('Erro: ' + data.error, 'error')");
code = code.replace(/alert\('Falha de rede\.'\)/g, "showToast('Falha de rede.', 'error')");
code = code.replace(/alert\(data\.message \|\| "Automação iniciada com sucesso!"\)/g, "showToast(data.message || 'Automação iniciada com sucesso!', 'success')");
code = code.replace(/alert\(\`Falha ao baixar amostra: \$\{err\.message \|\| err\}\`\)/g, "showToast(`Falha na automação: ${err.message || err}`, 'error')");

// 4. Inject the Toast UI in the render method (at the top of the main div)
const toastUI = `
      {/* Toast Notification */}
      {toast && (
        <div className={\`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-top-2 fade-in duration-300 \${
          toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' :
          toast.type === 'error' ? 'bg-red-950/90 border-red-500/50 text-red-200' :
          'bg-slate-900/90 border-slate-700 text-slate-200'
        }\`}>
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500" />}
          {toast.type === 'info' && <Activity className="w-5 h-5 text-blue-500" />}
          <p className="text-sm font-medium">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-2 hover:bg-white/10 p-1 rounded-md transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
`;

code = code.replace(
  /<div className="max-w-7xl mx-auto space-y-8">/,
  `${toastUI}\n        <div className="max-w-7xl mx-auto space-y-8">`
);

fs.writeFileSync('src/pages/Admin.tsx', code);
