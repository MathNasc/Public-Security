const fs = require('fs');
const file = 'src/pages/Result.tsx';
let content = fs.readFileSync(file, 'utf8');

// Insert Period Selector UI
const uiSelector = `
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 rounded-2xl p-4 shadow-xl border border-slate-700/50 mb-8 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2 items-center overflow-x-auto">
            <span className="text-slate-400 text-sm font-medium mr-2">Período:</span>
            {[
              { id: '1w', label: '1 Semana' },
              { id: '1m', label: '1 Mês' },
              { id: '3m', label: '3 Meses' },
              { id: '6m', label: '6 Meses' },
              { id: '12m', label: '1 Ano' },
              { id: 'all', label: 'Todo Período' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handleFilterChange('period', p.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  period === p.id ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" : "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-transparent"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center overflow-x-auto">
            <span className="text-slate-400 text-sm font-medium mr-2">Raio:</span>
            {[
              { id: '500', label: '500m' },
              { id: '1000', label: '1km' },
              { id: '2000', label: '2km' },
              { id: '5000', label: '5km' }
            ].map(r => (
              <button
                key={r.id}
                onClick={() => handleFilterChange('radius', r.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  radius === r.id ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" : "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-transparent"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
`;

content = content.replace('const [isComparing, setIsComparing] = useState(false);', `const [isComparing, setIsComparing] = useState(false);\n\n  const handleFilterChange = (key: string, value: string) => {\n    const newParams = new URLSearchParams(searchParams);\n    newParams.set(key, value);\n    navigate(\`/resultado?\${newParams.toString()}\`);\n  };`);

// Find where to insert it. Usually after the hero section.
content = content.replace(
  `</div>\n          </div>\n        </div>\n\n        {loading ? (`,
  uiSelector
);

fs.writeFileSync(file, content);
