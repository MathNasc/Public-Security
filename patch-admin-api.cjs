const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf-8');

const apiTabButton = `
          <button 
            className={\`pb-3 px-2 font-medium text-sm transition-colors \${activeTab === 'api' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-300'}\`}
            onClick={() => setActiveTab('api')}
          >
            Acesso à API (Pública)
          </button>
        </div>`;

code = code.replace(/Qualidade dos Dados\s*<\/button>\s*<\/div>/, "Qualidade dos Dados\n          </button>" + apiTabButton);

const apiTabContent = `
        {activeTab === 'api' && (
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <Database className="w-6 h-6 text-emerald-500" />
              <div>
                <h2 className="text-xl font-bold text-slate-200">API de Dados Abertos (V1)</h2>
                <p className="text-sm text-slate-400">Consuma os dados de segurança integrados em suas próprias aplicações.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Autenticação (X-API-Key)</h3>
                <p className="text-sm text-slate-400 mb-4">Para acessar os endpoints, inclua sua chave no header <code className="text-amber-500 bg-amber-500/10 px-1 rounded">X-API-Key</code>.</p>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value="test_api_key_123" 
                    className="bg-slate-900 border border-slate-700 text-slate-300 px-3 py-2 rounded-lg text-sm w-full font-mono"
                  />
                  <button onClick={() => alert('Chave copiada!')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors">
                    Copiar
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">Nota: Esta chave é estática para o protótipo. No ambiente de produção, chaves são geradas dinamicamente.</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-slate-300">Endpoints Disponíveis</h3>
                
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-blue-500/20 text-blue-400 font-mono text-xs px-2 py-1 rounded font-bold">GET</span>
                    <code className="text-slate-300 text-sm">/api/public/v1/indicators</code>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">Retorna indicadores agregados (nível estadual e municipal).</p>
                  <div className="text-xs text-slate-500 space-y-1">
                    <p><strong>Query Params:</strong></p>
                    <ul className="list-disc pl-4">
                      <li><code className="text-amber-500">uf</code>: Sigla do estado (ex: SP, RJ)</li>
                      <li><code className="text-amber-500">category</code>: Categoria do crime (ex: Homicídio doloso)</li>
                      <li><code className="text-amber-500">period</code>: Período (ex: 2025-01)</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-blue-500/20 text-blue-400 font-mono text-xs px-2 py-1 rounded font-bold">GET</span>
                    <code className="text-slate-300 text-sm">/api/public/v1/occurrences</code>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">Retorna ocorrências exatas com coordenadas geográficas.</p>
                  <div className="text-xs text-slate-500 space-y-1">
                    <p><strong>Query Params:</strong></p>
                    <ul className="list-disc pl-4">
                      <li><code className="text-amber-500">category</code>: Categoria do crime</li>
                      <li><code className="text-amber-500">limit</code>: Limite de resultados (máx: 500)</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mt-6">
                  <h4 className="text-red-400 font-semibold text-sm mb-1">Proteção contra Abuso (Rate Limit)</h4>
                  <p className="text-red-300/80 text-xs">O acesso à API é estritamente limitado a 100 requisições a cada 15 minutos por IP para garantir a estabilidade do banco de dados.</p>
                </div>
              </div>
            </div>
          </div>
        )}
`;

code = code.replace(/\{activeTab === 'quality' && <DataQualityTab \/>\}/, "{activeTab === 'quality' && <DataQualityTab />}\n" + apiTabContent);

fs.writeFileSync('src/pages/Admin.tsx', code);
console.log("Patched Admin.tsx with API tab");
