import fs from 'fs';
let code = fs.readFileSync('src/pages/Result.tsx', 'utf8');

const importsToAdd = `
import { WatchRegionButton } from '../components/WatchRegionButton';
import { AiSummary } from '../components/AiSummary';
`;

code = code.replace('import { MapUpdater } from "../components/MapUtils";', 'import { MapUpdater } from "../components/MapUtils";' + importsToAdd);

// Add button to header
const headerTarget = `<h2 className="text-3xl font-bold text-white mb-2">{address}</h2>`;
const headerReplacement = `
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">{address}</h2>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4"/> {lat}, {lon}</span>
                <span className="flex items-center gap-1"><Search className="w-4 h-4"/> Raio: {radius}m</span>
              </div>
            </div>
            <WatchRegionButton name={address} lat={lat} lon={lon} radius={radius} score={data.result?.score} />
          </div>
`;

code = code.replace(/<h2 className="text-3xl font-bold text-white mb-2">\{address\}<\/h2>[\s\S]*?<\/div>/m, headerReplacement);

// Replace the current temporal trend logic to also include the AiSummary
const temporalTrendRegex = /<motion\.div initial=\{\{ opacity: 0 \}\} animate=\{\{ opacity: 1 \}\} transition=\{\{ delay: 0\.2 \}\} className="bg-slate-900\/30 border border-slate-800 rounded-xl p-6">[\s\S]*?<\/motion\.div>/m;

const newTemporalTrendAndSummary = `
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-500" /> Comparação com Período Anterior
          </h3>
          {data.result?.trend?.previousScore !== undefined && data.result?.trend?.previousScore !== null ? (
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <span className="text-sm text-slate-400">Score Anterior</span>
                 <span className="text-lg font-bold text-slate-300">{data.result.trend.previousScore}</span>
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-sm text-slate-400">Score Atual</span>
                 <span className="text-lg font-bold text-white">{data.result.score}</span>
               </div>
               <div className="pt-4 border-t border-slate-800/50 flex items-center gap-4">
                 <div className={\`text-xl font-bold \${data.result.score > data.result.trend.previousScore ? "text-green-400" : (data.result.score < data.result.trend.previousScore ? "text-red-400" : "text-slate-400")}\`}>
                   {data.result.score > data.result.trend.previousScore ? '↑' : (data.result.score < data.result.trend.previousScore ? '↓' : '↔')} {Math.abs(data.result.score - data.result.trend.previousScore)} pontos
                 </div>
               </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 leading-relaxed max-w-3xl">
              Não há dados anteriores suficientes nesta região para calcular uma tendência estatisticamente válida.
            </p>
          )}
        </motion.div>
        
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
           <AiSummary data={data} />
        </motion.div>
      </div>
`;

code = code.replace(temporalTrendRegex, newTemporalTrendAndSummary);

fs.writeFileSync('src/pages/Result.tsx', code);
