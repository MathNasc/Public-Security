import React, { useEffect, useState } from 'react';
import { 
  Database, 
  MapPin, 
  Clock, 
  Activity, 
  ShieldCheck, 
  ArrowUpRight, 
  Search, 
  CheckCircle2, 
  FileText, 
  Layers, 
  Filter,
  Info
} from 'lucide-react';

export function DataQuality() {
  const [stats, setStats] = useState<any>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sources' | 'quality' | 'batches'>('sources');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/data-quality').then(r => r.json()).catch(() => null),
      fetch('/api/data-sources').then(r => r.json()).catch(() => [])
    ]).then(([statsData, sourcesData]) => {
      if (statsData && !statsData.error) {
        setStats(statsData);
      }
      if (Array.isArray(sourcesData)) {
        setSources(sourcesData);
      }
      setLoading(false);
    });
  }, []);

  const filteredSources = sources.filter((s: any) => {
    const matchesSearch = 
      (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.provider || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.coverage || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.state || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (filterType === 'national') return matchesSearch && (s.coverage === 'Nacional' || s.state === 'BR');
    if (filterType === 'state') return matchesSearch && s.coverage !== 'Nacional' && s.state !== 'BR';
    return matchesSearch;
  });

  return (
    <div className="px-4 py-8 max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            Transparência Governamental & Auditoria de Dados
          </div>

          <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
            Fontes de Dados & Qualidade Territorial
          </h1>

          <p className="text-slate-300 text-sm md:text-base max-w-3xl leading-relaxed">
            Consulte a matriz completa das 28 fontes oficiais governamentais integradas à plataforma,
            métricas de integridade espacial, qualidade temporal e histórico de processamento.
          </p>

          {/* Quick Metrics Bar */}
          {stats?.coverage && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800/80">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total de Registros</div>
                <div className="text-lg md:text-xl font-bold text-white mt-0.5">
                  {(stats.coverage.total ?? 0).toLocaleString('pt-BR')}
                </div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Com Coordenadas</div>
                <div className="text-lg md:text-xl font-bold text-emerald-400 mt-0.5">
                  {(stats.coverage.withCoordinates ?? 0).toLocaleString('pt-BR')}
                </div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Geocodificadas</div>
                <div className="text-lg md:text-xl font-bold text-blue-400 mt-0.5">
                  {(stats.coverage.geocoded ?? 0).toLocaleString('pt-BR')}
                </div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Fontes Monitoradas</div>
                <div className="text-lg md:text-xl font-bold text-amber-400 mt-0.5">
                  {sources.length > 0 ? sources.length : 28} Estados / BR
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-800 gap-2 sm:gap-6 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('sources')}
          className={`pb-3 px-1 sm:px-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'sources'
              ? 'text-amber-500 border-amber-500'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Matriz de Fontes (28 Fontes)</span>
        </button>

        <button
          onClick={() => setActiveTab('quality')}
          className={`pb-3 px-1 sm:px-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'quality'
              ? 'text-amber-500 border-amber-500'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Indicadores de Qualidade</span>
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          className={`pb-3 px-1 sm:px-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer ${
            activeTab === 'batches'
              ? 'text-amber-500 border-amber-500'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Histórico de Lotes</span>
        </button>
      </div>

      {/* Tab 1: Matriz de Fontes Oficial */}
      {activeTab === 'sources' && (
        <div className="space-y-6">
          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por estado, provedor ou portal..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                    filterType === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todas (28)
                </button>
                <button
                  onClick={() => setFilterType('national')}
                  className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                    filterType === 'national' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Nacional
                </button>
                <button
                  onClick={() => setFilterType('state')}
                  className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                    filterType === 'state' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Estaduais
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-800/30 flex items-center justify-between">
              <h2 className="font-bold text-slate-200 text-base flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-500" />
                Catálogo Oficial de Dados Abertos de Segurança Pública
              </h2>
              <span className="text-xs text-slate-400">
                Exibindo {filteredSources.length} de {sources.length || 28} fontes
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs">Carregando catálogo oficial de fontes...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="px-6 py-3.5 font-semibold border-b border-slate-800">Estado / Cobertura</th>
                      <th className="px-6 py-3.5 font-semibold border-b border-slate-800">Órgão Oficial / Provedor</th>
                      <th className="px-6 py-3.5 font-semibold border-b border-slate-800">Situação da Fonte</th>
                      <th className="px-6 py-3.5 font-semibold border-b border-slate-800">Canal Oficial de Dados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredSources.map((source: any) => {
                      const isNational = source.coverage === 'Nacional' || source.state === 'BR';
                      return (
                        <tr key={source.id} className="hover:bg-slate-800/30 transition-colors">
                          {/* Estado / Cobertura */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                isNational ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-amber-400 border border-slate-700'
                              }`}>
                                {isNational ? 'BR' : source.coverage || source.state}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-200">
                                  {isNational ? 'SINESP / MJSP Nacional' : `SSP-${source.coverage || source.state}`}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {isNational ? 'Abrangência Todo o Brasil' : `Estado de ${source.name || source.coverage}`}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Provedor */}
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-300">{source.provider || 'Secretaria de Segurança'}</div>
                            <div className="text-xs text-slate-500 truncate max-w-xs">{source.description || 'Portal Oficial de Dados Abertos'}</div>
                          </td>

                          {/* Situação */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              Monitorado / Ativo
                            </span>
                          </td>

                          {/* Link de Download */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {source.url ? (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-400 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-all rounded-lg"
                              >
                                <span>Acessar Portal Oficial</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-500 italic">Portal Governamental em Integração</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredSources.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                          Nenhuma fonte governamental encontrada para os filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Indicadores de Qualidade */}
      {activeTab === 'quality' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cobertura Geográfica */}
            <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-slate-200 font-bold flex items-center gap-2 text-base">
                <MapPin className="w-5 h-5 text-amber-500" /> Cobertura Geográfica & Precisão
              </h3>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Total de Ocorrências:</span>
                  <span className="font-bold text-slate-100">{(stats?.coverage?.total ?? 0).toLocaleString('pt-BR')}</span>
                </li>
                <li className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Com coordenadas exatas (GPS):</span>
                  <span className="font-bold text-emerald-400">{(stats?.coverage?.withCoordinates ?? 0).toLocaleString('pt-BR')}</span>
                </li>
                <li className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Sem coordenadas diretas:</span>
                  <span className="font-bold text-amber-400">{(stats?.coverage?.withoutCoordinates ?? 0).toLocaleString('pt-BR')}</span>
                </li>
                <li className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Geocodificadas (Recuperadas por endereço):</span>
                  <span className="font-bold text-blue-400">{(stats?.coverage?.geocoded ?? 0).toLocaleString('pt-BR')}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-400">Sem dados geográficos suficientes:</span>
                  <span className="font-bold text-slate-500">{(stats?.coverage?.notEnoughData ?? 0).toLocaleString('pt-BR')}</span>
                </li>
              </ul>
            </div>

            {/* Qualidade Temporal */}
            <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-slate-200 font-bold flex items-center gap-2 text-base">
                <Clock className="w-5 h-5 text-amber-500" /> Qualidade Temporal & Histórico
              </h3>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Registro Mais Antigo:</span>
                  <span className="font-semibold text-slate-200">
                    {stats?.temporal?.oldest ? new Date(stats.temporal.oldest).toLocaleDateString('pt-BR') : '-'}
                  </span>
                </li>
                <li className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Registro Mais Recente:</span>
                  <span className="font-semibold text-slate-200">
                    {stats?.temporal?.newest ? new Date(stats.temporal.newest).toLocaleDateString('pt-BR') : '-'}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-slate-400">Registros sem Data Especificada:</span>
                  <span className="font-semibold text-amber-400">
                    {(stats?.temporal?.withoutDate ?? 0).toLocaleString('pt-BR')}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Qualidade Categórica */}
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-slate-200 font-bold flex items-center gap-2 text-base">
              <Activity className="w-5 h-5 text-amber-500" /> Mapeamento Taxonômico de Delitos
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {(stats?.categories || []).map((c: any) => (
                <div key={c.category} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400 font-medium uppercase tracking-wider truncate">
                    {c.category || 'Desconhecida'}
                  </div>
                  <div className="text-lg font-bold text-white mt-1">
                    {(c?.count ?? 0).toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Histórico de Lotes / Importações */}
      {activeTab === 'batches' && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-800/30">
            <h2 className="font-bold text-slate-200 text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              Histórico de Processamento de Lotes (Read-Only)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs uppercase bg-slate-800/60 text-slate-400 tracking-wider">
                <tr>
                  <th className="px-6 py-3.5 font-semibold border-b border-slate-800">Data de Processamento</th>
                  <th className="px-6 py-3.5 font-semibold border-b border-slate-800">Arquivo / Fonte</th>
                  <th className="px-6 py-3.5 font-semibold border-b border-slate-800">Registros Válidos</th>
                  <th className="px-6 py-3.5 font-semibold border-b border-slate-800">Sem Coordenadas</th>
                  <th className="px-6 py-3.5 font-semibold border-b border-slate-800">Geocodificados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {(stats?.recentBatches || []).map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {b.startedAt ? new Date(b.startedAt).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="px-6 py-4 text-amber-400 font-medium truncate max-w-xs">
                      {b.filename || b.sourceName}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-100">
                      {(b.validRecords ?? 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-amber-400">
                      {(b.withoutCoordinates ?? 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-blue-400">
                      {(b.geocoded ?? 0).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}

                {(!stats?.recentBatches || stats.recentBatches.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      Nenhum lote de dados registrado até o momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataQuality;
