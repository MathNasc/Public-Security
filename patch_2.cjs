const fs = require('fs');

// Patch SafetyAnalysisService.ts
let serviceContent = fs.readFileSync('src/services/SafetyAnalysisService.ts', 'utf8');
serviceContent = serviceContent.replace(
  /const endDate = new Date\("2019-12-31T23:59:59Z"\);\n\s*const startDate = new Date\("2019-12-31T23:59:59Z"\);([\s\S]*?)startDate\.setMonth\(startDate\.getMonth\(\) - periodMonths\);\n\s*\}/,
  \`let endDate = new Date("2019-12-31T23:59:59Z");
    let startDate = new Date("2019-12-31T23:59:59Z");
    
    let effectiveMonths = periodMonths;
    if (/^\\d{4}$/.test(periodString)) {
      const year = parseInt(periodString, 10);
      startDate = new Date(\`\${year}-01-01T00:00:00Z\`);
      endDate = new Date(\`\${year}-12-31T23:59:59Z\`);
      effectiveMonths = 12;
    } else if (periodString === "1w") {
      startDate.setDate(startDate.getDate() - 7);
      effectiveMonths = 0.25;
    } else if (periodString === "1m") {
      startDate.setMonth(startDate.getMonth() - 1);
      effectiveMonths = 1;
    } else if (periodString === "3m") {
      startDate.setMonth(startDate.getMonth() - 3);
      effectiveMonths = 3;
    } else if (periodString === "6m") {
      startDate.setMonth(startDate.getMonth() - 6);
      effectiveMonths = 6;
    } else if (periodString === "all") {
      startDate.setFullYear(2010);
      effectiveMonths = 120;
    } else {
      startDate.setMonth(startDate.getMonth() - periodMonths);
    }\`
);
fs.writeFileSync('src/services/SafetyAnalysisService.ts', serviceContent);


// Patch Result.tsx
let resultContent = fs.readFileSync('src/pages/Result.tsx', 'utf8');

// Insert Filter UI if missing or update it
const filterUI = \`      </div>

      {/* Filtros */}
      <div className="bg-slate-800 rounded-2xl p-4 shadow-xl border border-slate-700/50 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-slate-400 text-sm font-medium mr-2">Período:</span>
          {[
            { id: '1w', label: '1 Semana' },
            { id: '1m', label: '1 Mês' },
            { id: '3m', label: '3 Meses' },
            { id: '6m', label: '6 Meses' },
            { id: '12m', label: '1 Ano' },
            { id: '2019', label: '2019' },
            { id: '2018', label: '2018' },
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
        <div className="flex flex-wrap gap-2 items-center">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">\`;

if (!resultContent.includes('Filtros')) {
  resultContent = resultContent.replace(
    \`      </div>\\n\\n      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">\`,
    filterUI
  );
} else {
  // Update it if it exists
  const startIdx = resultContent.indexOf('      {/* Filtros */}');
  const endIdx = resultContent.indexOf('      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">');
  if (startIdx !== -1 && endIdx !== -1) {
    resultContent = resultContent.substring(0, startIdx) + filterUI.substring(13) + resultContent.substring(endIdx + 61);
  }
}

fs.writeFileSync('src/pages/Result.tsx', resultContent);

