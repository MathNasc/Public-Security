import fs from 'fs';
let code = fs.readFileSync('src/pages/Result.tsx', 'utf8');

const anchor = '{/* FOOTER: Transparency */}';

const trendSection = `
      {/* TREND / COMPARISON */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-500" /> Tendência Temporal
        </h3>
        {data.result?.trend ? (
          <div className="flex items-center gap-4">
             <div className={\`text-2xl font-bold \${data.result.trend.percentage > 0 ? 'text-red-400' : 'text-green-400'}\`}>
               {data.result.trend.percentage > 0 ? '↑' : '↓'} {Math.abs(data.result.trend.percentage)}%
             </div>
             <p className="text-sm text-slate-400 leading-relaxed">
               {data.result.trend.label}
             </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 leading-relaxed max-w-3xl">
            A comparação temporal exige a consolidação de múltiplos ciclos de importação consecutivos. Esta métrica será habilitada assim que a base histórica desta região for expandida.
          </p>
        )}
      </motion.div>

      `;

code = code.replace(anchor, trendSection + anchor);
fs.writeFileSync('src/pages/Result.tsx', code);
