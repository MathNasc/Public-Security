import React from 'react';
import { useEffect, useState, useRef } from "react";
import { ShieldAlert, Activity, ShieldCheck, Clock, Server, UploadCloud, Database, MapPin } from "lucide-react";

function DataQualityTab() {
  const [stats, setStats] = useState<any>(null);
  
  useEffect(() => {
    fetch("/api/admin/data-quality")
      .then(r => r.json())
      .then(setStats);
  }, []);

  if (!stats) return <div className="p-6 text-slate-400">Carregando métricas...</div>;
  if (stats.error) return <div className="p-6 text-red-400">Erro: {stats.error}</div>;

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
            {(stats.categories || []).map((c: any) => (
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
              {(stats.recentBatches || []).map((b: any) => (
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
              <span className={`w-2 h-2 rounded-full ${ds.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
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
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      job.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 
                      job.status === 'failed' ? 'bg-red-500/20 text-red-400' : 
                      'bg-blue-500/20 text-blue-400'
                    }`}>
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

export function Admin() {
  const [sources, setSources] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("ingestion");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSources = () => {
    fetch("/api/data-sources")
      .then(r => r.json())
      .then(setSources);
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);

    try {
      const response = await fetch("/api/admin/upload-ssp", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(`Sucesso! ${data.inserted} registros importados do arquivo ${file.name}.`);
        fetchSources();
      } else {
        alert(`Erro na importação: ${data.error || 'Desconhecido'}`);
      }
    } catch (err: any) {
      alert("Falha ao enviar arquivo.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  
  const triggerEngine = async (engineName: string, endpoint: string) => {
    setIsUploading(true);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchSources(); // Refresh UI after trigger
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (e) {
      alert('Falha de rede.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadSample = async () => {

    setIsUploading(true);
    try {
      const response = await fetch("/api/admin/download-sample", { method: "POST" });
      const data = await response.json();
      
      if (response.ok) {
        alert(`Sucesso! ${data.inserted} registros da amostra real foram importados.`);
        fetchSources();
      } else {
        alert(`Erro na importação: ${data.error || 'Desconhecido'}`);
      }
    } catch (err) {
      alert(`Falha ao baixar amostra: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="px-4 py-12 relative overflow-hidden">
      <div className='absolute inset-0 opacity-10 pointer-events-none' style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)", backgroundSize: "40px 40px" }}></div>
      <div className="max-w-4xl mx-auto relative z-10">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-white">Admin / Data Ingestion</h1>
          <div className="flex flex-col sm:flex-row gap-2">
            <button 
              onClick={() => triggerEngine('SINESP', '/api/admin/ingestion/discovery')}
              disabled={isUploading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-900 border border-emerald-700 text-slate-100 font-semibold rounded-lg text-sm transition-colors w-full sm:w-auto text-center flex items-center justify-center gap-2"
            >
              <Database className="w-4 h-4" />
              {isUploading ? "Processando..." : "Executar Discovery SINESP (Nacional)"}
            </button>
            <button 
              onClick={handleDownloadSample}
              disabled={isUploading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 border border-slate-700 text-slate-200 font-semibold rounded-lg text-sm transition-colors w-full sm:w-auto text-center flex items-center justify-center gap-2"
            >
              <Database className="w-4 h-4" />
              {isUploading ? "Processando..." : "Baixar Amostra Real SSP (Web)"}
            </button>

            <div>
              <input 
                type="file" 
                accept=".csv" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 text-slate-950 font-semibold rounded-lg text-sm transition-colors w-full sm:w-auto text-center flex items-center gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                Upload Manual (CSV)
              </button>
            </div>
          </div>
        </div>

        <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
          <div className="p-2 bg-amber-500/20 rounded-full mt-0.5">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-amber-500 font-semibold text-lg">Modo de Demonstração (Dados Simulados)</h3>
            <p className="text-amber-500/80 text-sm mt-1">
              Os servidores oficiais do Governo Federal (dados.mj.gov.br) encontram-se temporariamente fora do ar ou com links quebrados. 
              Para garantir o funcionamento da plataforma, injetamos uma base de dados realista (fictícia) contemplando estatísticas nacionais e milhares de ocorrências espalhadas por CEPs de todo o Brasil. 
              Assim que o portal oficial retornar, você poderá fazer o Upload Manual do CSV original.
            </p>
          </div>
        </div>
        
        <div className="flex gap-4 mb-6 border-b border-slate-800">
          <button 
            className={`pb-3 px-2 font-medium text-sm transition-colors ${activeTab === 'ingestion' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-300'}`}
            onClick={() => setActiveTab('ingestion')}
          >
            Ingestão de Dados
          </button>
          <button 
            className={`pb-3 px-2 font-medium text-sm transition-colors ${activeTab === 'quality' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-300'}`}
            onClick={() => setActiveTab('quality')}
          >
            Qualidade dos Dados
          </button>
          <button 
            className={`pb-3 px-2 font-medium text-sm transition-colors ${activeTab === 'api' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-300'}`}
            onClick={() => setActiveTab('api')}
          >
            Acesso à API (Pública)
          </button>
        </div>

        
        {activeTab === 'automation' && <AutomationTab />}
        {activeTab === 'ingestion' && (

          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-800 bg-slate-800/30 flex items-center gap-3">
              <Server className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-slate-200">Fontes de Dados Conectadas</h2>
            </div>
            
            <div className="divide-y divide-slate-800/50">
              {(Array.isArray(sources) ? sources : []).map(source => (
                <div key={source.id} className="px-6 py-5 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-200">{source.name}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                        {source.status === "active" ? "Ativo" : source.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{source.description}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-500" /> {source.coverage}
                      </span>
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3 text-slate-400" /> Registros: {source.recordsImported?.toLocaleString('pt-BR') || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" /> Atualizado: {new Date(source.updatedAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  
                  <a href={source.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-amber-500 hover:text-amber-400 hover:underline">
                    Ver origem
                  </a>
                </div>
              ))}
              {(!Array.isArray(sources) || sources.length === 0) && (
                <div className="px-6 py-12 text-center text-slate-500">
                  Nenhuma fonte de dados configurada.
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'quality' && <DataQualityTab />}

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


      </div>
    </div>
  );
}
