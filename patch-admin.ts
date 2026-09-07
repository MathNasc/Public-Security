import fs from 'fs';
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

const automationTabCode = `
function AutomationTab() {
  const [data, setData] = useState<any>(null);
  
  useEffect(() => {
    fetch("/api/admin/ingestion/status")
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) return <div className="p-6 text-slate-400">Carregando status da automação...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Activity className="text-amber-500"/>
          Orquestração e Automação (Fase 10)
        </h2>
        <button 
          onClick={() => fetch("/api/admin/ingestion/discovery", { method: 'POST' }).then(() => alert('Discovery disparado!'))}
          className="bg-slate-800 hover:bg-slate-700 text-amber-500 border border-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Executar Discovery Nacional
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.datasets?.map((ds: any) => (
          <div key={ds.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-slate-200">{ds.name}</h3>
              <span className={\`w-2 h-2 rounded-full \${ds.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'}\`}></span>
            </div>
            <div className="text-xs text-slate-400 mb-1">Fonte: {ds.sourceId}</div>
            <div className="text-xs text-slate-500 mb-2">Status: {ds.status}</div>
            <div className="text-xs text-slate-400">
              Última Versão: <span className="text-amber-400">{ds.lastVersion || 'Nenhuma'}</span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-slate-300 font-semibold mb-4">Jobs em Andamento / Recentes</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm text-left text-slate-400">
            <thead className="text-xs uppercase bg-slate-800/50 text-slate-400">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Fonte</th>
                <th className="px-4 py-3">Versão</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Última Atualização</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs?.map((job: any) => (
                <tr key={job.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-xs">{job.id.substring(0,8)}...</td>
                  <td className="px-4 py-3 text-slate-200">{job.sourceId}</td>
                  <td className="px-4 py-3 text-amber-500">{job.version}</td>
                  <td className="px-4 py-3">
                    <span className={\`px-2 py-1 rounded text-xs font-medium \${
                      job.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 
                      job.status === 'failed' ? 'bg-red-500/20 text-red-400' : 
                      'bg-blue-500/20 text-blue-400'
                    }\`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{new Date(job.updatedAt || job.completedAt || new Date()).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
              {!data.jobs?.length && (
                <tr><td colSpan={5} className="px-4 py-6 text-center">Nenhum job recente.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`;

code = code.replace('export function Admin() {', automationTabCode + '\nexport function Admin() {');

// Add tab button
const tabButtonHtml = `
          <button 
            onClick={() => setActiveTab('automation')}
            className={\`pb-3 px-2 font-medium text-sm transition-colors \${activeTab === 'automation' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-300'}\`}
          >
            Orquestração
          </button>
          <button 
`;
code = code.replace('<button \n            onClick={() => setActiveTab(\'ingestion\')}', tabButtonHtml + '<button \n            onClick={() => setActiveTab(\'ingestion\')}');

// Add tab content rendering
const tabContentHtml = `
        {activeTab === 'automation' && <AutomationTab />}
        {activeTab === 'ingestion' && (
`;
code = code.replace("{activeTab === 'ingestion' && (", tabContentHtml);

fs.writeFileSync('src/pages/Admin.tsx', code);
