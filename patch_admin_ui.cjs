const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// Replace the two grids (Backbone and Adapters) with a single Table layout.
const beginRegex = /\{\/\* Backbone Nacional \*\/\}/;
const endRegex = /\{\/\* Logs de Ingestão \*\/\}/;

const before = code.substring(0, code.search(beginRegex));
const after = code.substring(code.search(endRegex));

const newTable = `
            {/* Tabela de Status de Integrações (Substituindo Grid Antigo) */}
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-800 bg-slate-800/30">
                <h2 className="font-semibold text-slate-200">Status dos Links Oficiais de Dados</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-800/50 text-slate-400">
                      <th className="px-6 py-4 font-medium border-b border-slate-800">Estado / Cobertura</th>
                      <th className="px-6 py-4 font-medium border-b border-slate-800">Situação</th>
                      <th className="px-6 py-4 font-medium border-b border-slate-800">Fonte de Dados</th>
                      <th className="px-6 py-4 font-medium border-b border-slate-800">Link de Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {Array.isArray(sources) && sources.map((source) => {
                      let statusEl;
                      if (source.status === 'SUCCESS') {
                        statusEl = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>Atualizado com sucesso</span>;
                      } else if (source.status === 'FAILED') {
                        statusEl = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>Não atualizado</span>;
                      } else if (source.status === 'PARTIAL') {
                        statusEl = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>Atualizado parcialmente</span>;
                      } else {
                        statusEl = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20"><div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>Pendente</span>;
                      }

                      return (
                        <tr key={source.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {source.coverage === 'Nacional' ? <MapPin className="w-4 h-4 text-emerald-500" /> : <div className="w-4 text-center font-bold text-slate-500">{source.coverage}</div>}
                              <span className="font-medium text-slate-200">{source.coverage === 'Nacional' ? 'SINESP Nacional' : source.coverage}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {statusEl}
                            {source.errorMessage && <p className="text-xs text-red-400/80 mt-1">{source.errorMessage}</p>}
                          </td>
                          <td className="px-6 py-4 text-slate-300">
                            {source.provider}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                            {source.url ? (
                              <a href={source.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1">
                                {source.url.replace('https://www.', '')} <ArrowUpRight className="w-3 h-3" />
                              </a>
                            ) : (
                              'Indisponível'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            `;

const ArrowUpRightImport = `import { ArrowUpRight, Activity, Database, Server, RefreshCw, UploadCloud, Cpu, Layers, PlayCircle, Clock, MapPin, Shield, CheckCircle2, AlertTriangle, FileText } from "lucide-react";`;
let updatedCode = before + newTable + after;
updatedCode = updatedCode.replace(/import \{ Activity[^}]+\} from "lucide-react";/, ArrowUpRightImport);
fs.writeFileSync('src/pages/Admin.tsx', updatedCode);

console.log('UI Patched!');
