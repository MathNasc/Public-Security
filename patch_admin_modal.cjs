const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

const toastAndModalUI = `
      {/* Toast Notification */}
      {toast && (
        <div className={\`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border animate-in slide-in-from-top-4 fade-in duration-300 \${
          toast.type === 'success' ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200' :
          toast.type === 'error' ? 'bg-red-950/95 border-red-500/50 text-red-200' :
          'bg-slate-900/95 border-slate-700 text-slate-200'
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

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-slate-200">Autenticação Necessária</h3>
              </div>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-400 hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-400">
                Para executar a automação de varredura nos 27 estados (Crawler), insira a senha administrativa configurada no servidor (ADMIN_SECRET).
              </p>
              <input 
                type="password"
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && triggerCrawler()}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                autoFocus
              />
            </div>
            <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => setIsPasswordModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={triggerCrawler}
                disabled={!adminPassword}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-100 font-semibold rounded-lg text-sm transition-colors flex items-center gap-2"
              >
                Autenticar
              </button>
            </div>
          </div>
        </div>
      )}
`;

code = code.replace(
  /<div className="px-4 py-12 relative overflow-hidden">/,
  `<div className="px-4 py-12 relative overflow-hidden">\n${toastAndModalUI}`
);

fs.writeFileSync('src/pages/Admin.tsx', code);
