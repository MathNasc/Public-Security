const fs = require('fs');

let code = fs.readFileSync('src/pages/Admin.tsx', 'utf-8');

// The new Data Quality component to add
const dataQualityCode = `
function DataQualityTab() {
  const [stats, setStats] = useState<any>(null);
  
  useEffect(() => {
    fetch("/api/admin/data-quality")
      .then(r => r.json())
      .then(setStats);
  }, []);

  if (!stats) return <div className="p-6 text-slate-400">Carregando métricas...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Cobertura Geográfica */}
        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
          <h3 className="text-slate-300 font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-500"/> Cobertura Geográfica
          </h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex justify-between"><span>Total de Ocorrências:</span> <span className="text-slate-200">{stats.coverage.total.toLocaleString('pt-BR')}</span></li>
            <li className="flex justify-between"><span>Com coordenadas (Exatas):</span> <span className="text-emerald-400">{stats.coverage.withCoordinates.toLocaleString('pt-BR')}</span></li>
            <li className="flex justify-between"><span>Sem coordenadas:</span> <span className="text-amber-400">{stats.coverage.withoutCoordinates.toLocaleString('pt-BR')}</span></li>
            <li className="flex justify-between"><span>Geocodificadas (Recuperadas):</span> <span className="text-blue-400">{stats.coverage.geocoded.toLocaleString('pt-BR')}</span></li>
            <li className="flex justify-between"><span>Falha de Geocodificação:</span> <span className="text-red-400">{stats.coverage.failedGeocoding.toLocaleString('pt-BR')}</span></li>
            <li className="flex justify-between"><span>S/ Endereço (Impossível):</span> <span className="text-slate-500">{stats.coverage.notEnoughData.toLocaleString('pt-BR')}</span></li>
          </ul>
        </div>

        {/* Qualidade Temporal */}
        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
          <h3 className="text-slate-300 font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500"/> Qualidade Temporal
          </h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex justify-between"><span>Registro Mais Antigo:</span> <span className="text-slate-200">{stats.temporal.oldest ? new Date(stats.temporal.oldest).toLocaleDateString('pt-BR') : '-'}</span></li>
            <li className="flex justify-between"><span>Registro Mais Recente:</span> <span className="text-slate-200">{stats.temporal.newest ? new Date(stats.temporal.newest).toLocaleDateString('pt-BR') : '-'}</span></li>
            <li className="flex justify-between"><span>Registros sem Data:</span> <span className="text-amber-400">{stats.temporal.withoutDate.toLocaleString('pt-BR')}</span></li>
          </ul>
        </div>

        {/* Qualidade Categórica */}
        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700 md:col-span-2">
          <h3 className="text-slate-300 font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-500"/> Categorias Identificadas
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {stats.categories.map((c: any) => (
              <div key={c.category} className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">{c.category || 'Desconhecida'}</div>
                <div className="text-lg font-bold text-slate-200 mt-1">{c.count.toLocaleString('pt-BR')}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
      
      {/* Últimas Importações */}
      <div>
        <h3 className="text-slate-300 font-semibold mb-4">Últimos Lotes (Batches)</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm text-left text-slate-400">
            <thead className="text-xs uppercase bg-slate-800/50 text-slate-400">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3">Válidos</th>
                <th className="px-4 py-3">Sem Coordenadas</th>
                <th className="px-4 py-3">Geocodificados</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentBatches.map((b: any) => (
                <tr key={b.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3">{new Date(b.startedAt).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-amber-500 truncate max-w-[150px]">{b.filename || b.sourceName}</td>
                  <td className="px-4 py-3 text-slate-200">{b.validRecords.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-amber-400">{b.withoutCoordinates.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-blue-400">{b.geocoded.toLocaleString('pt-BR')}</td>
                </tr>
              ))}
              {stats.recentBatches.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center">Nenhuma importação realizada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`;

// Insert the DataQualityTab function definition just before "export function Admin()"
code = code.replace('export function Admin() {', dataQualityCode + '\nexport function Admin() {');

// Add tab state to Admin
code = code.replace(
  'const [isUploading, setIsUploading] = useState(false);',
  'const [isUploading, setIsUploading] = useState(false);\n  const [activeTab, setActiveTab] = useState("ingestion");'
);

// Replace the content inside Admin to use Tabs
const tabbedContent = `
        <div className="flex gap-4 mb-6 border-b border-slate-800">
          <button 
            className={\`pb-3 px-2 font-medium text-sm transition-colors \${activeTab === 'ingestion' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-300'}\`}
            onClick={() => setActiveTab('ingestion')}
          >
            Ingestão de Dados
          </button>
          <button 
            className={\`pb-3 px-2 font-medium text-sm transition-colors \${activeTab === 'quality' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-300'}\`}
            onClick={() => setActiveTab('quality')}
          >
            Qualidade dos Dados
          </button>
        </div>

        {activeTab === 'ingestion' && (
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
`;

code = code.replace(
  '<div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">',
  tabbedContent
);

// Close the if activeTab block
code = code.replace(
  '</div>\n      </div>\n    </div>',
  '</div>\n        )}\n        {activeTab === "quality" && <DataQualityTab />}\n      </div>\n    </div>'
);

fs.writeFileSync('src/pages/Admin.tsx', code);
console.log('Patched Admin.tsx');
