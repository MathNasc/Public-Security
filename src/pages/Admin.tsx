import React from 'react';
import { useEffect, useState, useRef } from "react";
import { X, CheckCircle2, ArrowUpRight, ShieldAlert, Activity, ShieldCheck, Clock, Server, UploadCloud, Database, MapPin, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

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


function AutomationTab({ showToast }: { showToast: (msg: string, type?: "success"|"error"|"info") => void }) {
  const [data, setData] = useState<any>(null);
  const [operational, setOperational] = useState<any>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [forceTrigger, setForceTrigger] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState<string | null>(null);

  const loadData = () => {
    fetch("/api/admin/ingestion/status")
      .then(r => r.json())
      .then(setData)
      .catch(console.error);

    fetch("/api/admin/pipeline/operational-status?source=SSP-SP")
      .then(r => r.json())
      .then(setOperational)
      .catch(console.error);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerSsp = async () => {
    setIsTriggering(true);
    try {
      const res = await fetch("/api/admin/pipeline/trigger-ssp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: forceTrigger })
      });
      const resJson = await res.json();
      if (resJson.success) {
        showToast(resJson.reason || "Ciclo de automação SSP-SP concluído com sucesso!", "success");
      } else {
        showToast(resJson.reason || resJson.error || "Ciclo não pôde ser executado.", "info");
      }
      loadData();
    } catch (e: any) {
      showToast("Falha ao acionar automação: " + e.message, "error");
    } finally {
      setIsTriggering(false);
    }
  };

  const handleReprocessJob = async (jobId: string) => {
    setIsReprocessing(jobId);
    try {
      const res = await fetch(`/api/admin/pipeline/reprocess/${jobId}`, { method: "POST" });
      const resJson = await res.json();
      if (resJson.success) {
        showToast(resJson.message, "success");
      } else {
        showToast(resJson.error || "Falha ao reprocessar.", "error");
      }
      loadData();
    } catch (e: any) {
      showToast("Erro ao reprocessar: " + e.message, "error");
    } finally {
      setIsReprocessing(null);
    }
  };

  if (!data) return <div className="p-6 text-slate-400">Carregando telemetria da automação...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="text-amber-500"/>
            Automação do Pipeline - Fonte Validada (SSP-SP)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitoramento das 20 etapas de automação e telemetria operacional em tempo real
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input 
              type="checkbox" 
              checked={forceTrigger} 
              onChange={e => setForceTrigger(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500"
            />
            Forçar ciclo (ignora cache)
          </label>
          <button 
            disabled={isTriggering}
            onClick={handleTriggerSsp}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <Server className="w-4 h-4"/>
            {isTriggering ? "Executando..." : "Disparar Automação SSP-SP"}
          </button>
        </div>
      </div>

      {/* Painel de Métricas Operacionais Obrigatórias */}
      {operational && (
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                operational.sourceStatus === 'OPERATIONAL' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                operational.sourceStatus === 'FAILING' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                ● {operational.sourceStatus}
              </span>
              <span className="text-sm font-semibold text-slate-200">
                {operational.sourceName} ({operational.sourceId})
              </span>
            </div>
            <div className="text-xs text-slate-400">
              {operational.sourceDelay?.diagnosis}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Última Tentativa */}
            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 font-medium">1. Última Tentativa</div>
              <div className="text-sm font-semibold text-slate-200 mt-1">
                {operational.lastAttempt ? new Date(operational.lastAttempt).toLocaleTimeString('pt-BR') : 'Nunca'}
              </div>
              <div className="text-[11px] text-slate-500">
                {operational.lastAttempt ? new Date(operational.lastAttempt).toLocaleDateString('pt-BR') : '-'}
              </div>
            </div>

            {/* 2. Último Sucesso */}
            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 font-medium">2. Último Sucesso</div>
              <div className="text-sm font-semibold text-emerald-400 mt-1">
                {operational.lastSuccess ? new Date(operational.lastSuccess).toLocaleTimeString('pt-BR') : 'Nenhum'}
              </div>
              <div className="text-[11px] text-slate-500">
                {operational.lastSuccess ? new Date(operational.lastSuccess).toLocaleDateString('pt-BR') : '-'}
              </div>
            </div>

            {/* 3. Última Falha */}
            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 font-medium">3. Última Falha</div>
              <div className="text-sm font-semibold text-red-400 mt-1">
                {operational.lastFailure ? new Date(operational.lastFailure).toLocaleTimeString('pt-BR') : 'Nenhuma'}
              </div>
              <div className="text-[11px] text-slate-500">
                {operational.lastFailure ? new Date(operational.lastFailure).toLocaleDateString('pt-BR') : 'Sem falhas'}
              </div>
            </div>

            {/* 4. Duração */}
            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 font-medium">4. Duração</div>
              <div className="text-sm font-semibold text-slate-200 mt-1">
                {operational.durationFormatted || '-'}
              </div>
              <div className="text-[11px] text-slate-500">Tempo de execução</div>
            </div>

            {/* 5. Quantidade de Registros */}
            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 font-medium">5. Registros (Lidos/Válidos)</div>
              <div className="text-sm font-semibold text-slate-200 mt-1">
                {operational.recordsValid} / {operational.recordsRead}
              </div>
              <div className="text-[11px] text-emerald-500">
                +{operational.recordsInserted} inseridos
              </div>
            </div>

            {/* 6. Taxa de Registros Inválidos */}
            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 font-medium">6. Taxa de Inválidos</div>
              <div className={`text-sm font-semibold mt-1 ${operational.invalidRate > 10 ? 'text-amber-400' : 'text-slate-200'}`}>
                {operational.invalidRate}%
              </div>
              <div className="text-[11px] text-slate-500">Limite de tolerância: 50%</div>
            </div>

            {/* 7. Duplicidades */}
            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 font-medium">7. Duplicidades</div>
              <div className="text-sm font-semibold text-slate-200 mt-1">
                {operational.duplicatesCount}
              </div>
              <div className="text-[11px] text-slate-500">Descartadas por hash</div>
            </div>

            {/* 8. Retries */}
            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 font-medium">8. Retries</div>
              <div className="text-sm font-semibold text-slate-200 mt-1">
                {operational.retries} / {operational.maxRetries}
              </div>
              <div className="text-[11px] text-slate-500">Tentativas automáticas</div>
            </div>

            {/* 9. Status do Job */}
            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 font-medium">9. Status do Job</div>
              <div className="text-sm font-semibold mt-1">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  operational.currentJobStatus === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                  operational.currentJobStatus === 'FAILED' ? 'bg-red-500/20 text-red-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {operational.currentJobStatus || 'Nenhum'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 truncate" title={operational.lastError || ''}>
                {operational.lastError ? operational.lastError.substring(0, 25) + '...' : 'Sem erros'}
              </div>
            </div>

            {/* 10. Atraso da Fonte */}
            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 font-medium">10. Atraso da Fonte</div>
              <div className={`text-sm font-semibold mt-1 ${
                operational.sourceDelay?.delayStatus === 'EM_DIA' ? 'text-emerald-400' :
                operational.sourceDelay?.delayStatus === 'TOLERAVEL' ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {operational.sourceDelay?.delayDays} dias ({operational.sourceDelay?.delayStatus})
              </div>
              <div className="text-[11px] text-slate-500">Freq: {operational.sourceDelay?.expectedFrequency}</div>
            </div>
          </div>
        </div>
      )}

      {/* Datasets Configurados */}
      <div>
        <h3 className="text-slate-300 font-semibold mb-3">Datasets Monitorados</h3>
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
      </div>

      {/* Tabela de Jobs e Ação de Reprocessamento */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-300 font-semibold">Histórico de Execução de Jobs (Auditoria de Idempotência)</h3>
          <button
            onClick={() => fetch("/api/admin/ingestion/discovery", { method: 'POST' }).then(() => showToast('Discovery disparado!', 'success'))}
            className="text-xs text-slate-400 hover:text-slate-200 underline"
          >
            Executar Discovery Geral
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm text-left text-slate-400">
            <thead className="text-xs uppercase bg-slate-800/50 text-slate-400">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Fonte</th>
                <th className="px-4 py-3">Versão</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Registros</th>
                <th className="px-4 py-3">Última Atualização</th>
                <th className="px-4 py-3 text-right">Ações</th>
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
                  <td className="px-4 py-3 text-slate-300">
                    {job.recordsInserted ? `${job.recordsInserted} inseridos` : (job.recordsRead ? `${job.recordsRead} lidos` : '-')}
                  </td>
                  <td className="px-4 py-3">{new Date(job.updatedAt || job.completedAt || new Date()).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={isReprocessing === job.id}
                      onClick={() => handleReprocessJob(job.id)}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-2.5 py-1 rounded transition-colors disabled:opacity-50"
                    >
                      {isReprocessing === job.id ? "Reenfileirando..." : "Reprocessar"}
                    </button>
                  </td>
                </tr>
              ))}
              {!data.jobs?.length && (
                <tr><td colSpan={7} className="px-4 py-6 text-center">Nenhum job recente.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function Admin() {

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const [sources, setSources] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("automation");
  const [isArchExpanded, setIsArchExpanded] = useState(false);
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
    setSources(prev => prev.map(s => ({...s, status: "PENDING"})));

    try {
      const response = await fetch("/api/admin/upload-ssp", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      
      if (response.ok) {
        showToast(`Sucesso! ${data.inserted} registros importados do arquivo ${file.name}.`, 'success');
        fetchSources();
      } else {
        showToast(`Erro na importação: ${data.error || 'Desconhecido'}`, 'error');
      }
    } catch (err: any) {
      showToast('Falha ao enviar arquivo.', 'error');
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
        showToast(data.message, 'success');
        fetchSources(); // Refresh UI after trigger
      } else {
        showToast('Erro: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Falha de rede.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  
  
  const triggerCrawler = async () => {
    if (!adminPassword) {
      setIsPasswordModalOpen(true);
      return;
    }
    
    setIsUploading(true);
    setIsPasswordModalOpen(false);
    
    try {
      const response = await fetch("/api/admin/automation/trigger-all", { 
        method: "POST", 
        headers: { 'Authorization': `Bearer ${adminPassword}` } 
      });
  
      const data = await response.json();
      
      if (response.ok) {
        showToast(data.message || 'Fontes verificadas com sucesso! Status atualizados.', 'success');
        fetchSources();
      } else {
        showToast(`Erro na importação: ${data.error || 'Desconhecido'}`, 'error');
      }
    } catch (err) {
      showToast(`Falha na automação: ${err.message || err}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="px-4 py-12 relative overflow-hidden">

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border animate-in slide-in-from-top-4 fade-in duration-300 ${
          toast.type === 'success' ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200' :
          toast.type === 'error' ? 'bg-red-950/95 border-red-500/50 text-red-200' :
          'bg-slate-900/95 border-slate-700 text-slate-200'
        }`}>
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

      <div className='absolute inset-0 opacity-10 pointer-events-none' style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)", backgroundSize: "40px 40px" }}></div>
      <div className="max-w-4xl mx-auto relative z-10">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-white">Admin / Data Ingestion</h1>
          <div className="flex flex-col sm:flex-row gap-2">

            <button 
              onClick={triggerCrawler}
              disabled={isUploading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 border border-slate-700 text-slate-200 font-semibold rounded-lg text-sm transition-colors w-full sm:w-auto text-center flex items-center justify-center gap-2"
            >
              <Database className="w-4 h-4" />
              {isUploading ? "Processando..." : "Rodar Automação Completa (Crawler Todos os Estados)"}
            </button>

            
  
            <div>
              <input type="file" 
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


        <div className="flex gap-4 mb-6 border-b border-slate-800">
          <button 
            className={`pb-3 px-2 font-medium text-sm transition-colors ${activeTab === 'automation' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-300'}`}
            onClick={() => setActiveTab('automation')}
          >
            Automação (SSP-SP)
          </button>
          <button 
            className={`pb-3 px-2 font-medium text-sm transition-colors ${activeTab === 'ingestion' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-300'}`}
            onClick={() => setActiveTab('ingestion')}
          >
            Ingestão Manual
          </button>
          <button 
            className={`pb-3 px-2 font-medium text-sm transition-colors ${activeTab === 'quality' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-300'}`}
            onClick={() => setActiveTab('quality')}
          >
            Qualidade dos Dados
          </button>
        </div>

        
        {activeTab === 'automation' && <AutomationTab showToast={showToast} />}
        {activeTab === 'ingestion' && (
          <div className="space-y-6">
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
              <div 
                className="px-6 py-5 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setIsArchExpanded(!isArchExpanded)}
              >
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-amber-500" />
                  <h2 className="font-semibold text-slate-200">Arquitetura de Ingestão de Dados - Vizinhança</h2>
                </div>
                <button className="text-slate-400 hover:text-slate-200 transition-colors">
                  {isArchExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
              
              {isArchExpanded && (
                <div className="p-6 overflow-x-auto text-[10px] sm:text-xs md:text-sm font-mono text-slate-400 bg-black/40">
                  <pre className="min-w-[400px] text-center mx-auto">{`            VIZINHANÇA
                 │
    ┌────────────┴────────────┐
    │                         │
SINESP/MJSP            Fontes Estaduais
(Nacional)                    │
                        ┌─────┼─────┐
                        │     │     │
                       SP    RJ    MG
                        │     │     │
                       ES    RS    ...
                        │
              Adapters Independentes
                        │
           ┌────────────┴────────────┐
           │                         │
      CSV/ZIP/API                XLS/XLSX
           │                         │
           └────────────┬────────────┘
                        ↓
                   RAW STORAGE
                        ↓
                  NORMALIZAÇÃO
                        ↓
                  DEDUPLICAÇÃO
                        ↓
                POSTGRES/POSTGIS
                        ↓
                  INDICADORES
                        ↓
                 SAFETY SCORE`}</pre>
                </div>
              )}
            </div>

            
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
                              <span className="text-slate-500 italic text-sm">URL não informada</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            
          </div>
        )}
        
        {activeTab === 'quality' && <DataQualityTab />}
      </div>
    </div>
  );
}
export default Admin;
  