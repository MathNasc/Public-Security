import React from "react";
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Circle } from "react-leaflet";
import { ShieldCheck, ShieldAlert, Shield, AlertTriangle, MapPin, Activity, Search, Database, GitCompare, BarChart3 } from "lucide-react";
import * as motion from "motion/react-client";
import { cn } from "../lib/utils";
import { MapUpdater } from "../components/MapUtils";
import { WatchRegionButton } from '../components/WatchRegionButton';
import { AiSummary } from '../components/AiSummary';


export function Result() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const radius = searchParams.get("radius") || "1000";
  const address = searchParams.get("address") || "Localização";
  const period = searchParams.get("period") || "12m";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  useEffect(() => {
    if (!lat || !lon) return;
    
    setLoading(true);
    let effectivePeriod = period;
    if (period === "all_history") effectivePeriod = "all";

    fetch(`/api/analysis?lat=${lat}&lon=${lon}&radius=${radius}&period=${effectivePeriod}`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [lat, lon, radius, period]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
      const results = await res.json();
      setSuggestions(results);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelect = (item: any) => {
    setSuggestions([]);
    setQuery("");
    if (isComparing) {
      navigate(`/comparar?lat1=${lat}&lon1=${lon}&address1=${encodeURIComponent(address)}&lat2=${item.latitude}&lon2=${item.longitude}&address2=${encodeURIComponent(item.formattedAddress)}`);
    } else {
      navigate(`/resultado?lat=${item.latitude}&lon=${item.longitude}&address=${encodeURIComponent(item.formattedAddress)}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 animate-pulse">Analisando histórico de segurança...</p>
      </div>
    );
  }

  if (!data || data.error || !lat || !lon) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        Não foi possível carregar os dados. Verifique o endereço e tente novamente.
      </div>
    );
  }

  const center: [number, number] = [parseFloat(lat), parseFloat(lon)];
  
  let scoreColor = "text-green-400";
  let bgScore = "bg-slate-900/50 border-slate-800";
  let Icon = ShieldCheck;
  const isInsufficient = data.score.classification === "Dados insuficientes";

  if (isInsufficient) {
    scoreColor = "text-slate-500";
    Icon = Shield;
  } else if (data.score.value < 40) {
    scoreColor = "text-red-400";
    bgScore = "bg-red-950/20 border-red-900/50";
    Icon = ShieldAlert;
  } else if (data.score.value < 75) {
    scoreColor = "text-amber-500";
    bgScore = "bg-amber-950/20 border-amber-900/50";
    Icon = AlertTriangle;
  }

  const confidenceValue = data.result?.confidence ? (data.result.confidence * 100).toFixed(0) : 0;
  
  return (
    <div className="px-4 py-8 max-w-5xl mx-auto space-y-8 relative">
      <div className='absolute inset-0 opacity-10 pointer-events-none -z-10' style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)", backgroundSize: "40px 40px" }}></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-amber-500" />
            Resultado da Análise
          </h1>
          <p className="text-slate-400 text-sm line-clamp-1 max-w-lg">{address}</p>
        </div>
        
        <div className="relative w-full md:w-[450px] z-40">
          <div className="flex gap-2 w-full">
            <form onSubmit={handleSearch} className="relative flex items-center flex-1">
              <Search className="absolute left-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                aria-label="Pesquisar local"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isComparing ? "Digite o 2º local para comparar..." : "Pesquisar outro local..."}
                className={cn("w-full bg-slate-900 border rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-slate-200 placeholder:text-slate-500", isComparing ? "border-amber-500/50" : "border-slate-700")}
              />
            </form>
            <button 
              onClick={() => setIsComparing(!isComparing)}
              className={cn("px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2", isComparing ? "bg-amber-500/10 border-amber-500/50 text-amber-500" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700")}
            >
              <GitCompare className="w-4 h-4" /> <span className="hidden sm:inline">Comparar</span>
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden">
              <ul className="max-h-60 overflow-y-auto divide-y divide-slate-700/50">
                {(suggestions || []).map((item, idx) => (
                  <li key={idx}>
                    <button
                      onClick={() => handleSelect(item)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-700/50 transition-colors"
                    >
                      <p className="text-slate-200 text-sm font-medium line-clamp-1">{item.formattedAddress}</p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {item.city} {item.state ? `- ${item.state}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className={cn("md:col-span-1 rounded-2xl p-6 border flex flex-col justify-center", bgScore)}>
          <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-4">Safety Score</div>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="stroke-current text-slate-800" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                {!isInsufficient && (
                  <path className={cn("stroke-current", scoreColor)} strokeWidth="3" strokeDasharray={`${data.score.value}, 100`} strokeLinecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                )}
              </svg>
              <span className="absolute text-2xl font-bold text-white">
                {isInsufficient ? "-" : data.score.value}
              </span>
            </div>
            <div>
              <div className={cn("font-bold text-lg", scoreColor)}>{data.score.classification}</div>
              <div className="text-xs text-slate-400 mt-1">
                {isInsufficient ? "Sem histórico para avaliação" : `Escala de 0 (perigoso) a 100 (seguro)`}
              </div>
            </div>
          </div>
          
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 mt-2">
            <h3 className="text-xs font-bold text-slate-300 mb-1">Confiança: {confidenceValue}%</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isInsufficient
                 ? "Não há dados públicos recentes suficientes para gerar uma avaliação confiável nesta área e período."
                 : `O resultado é baseado em dados com ${data.result?.coverage?.geographic ? (data.result.coverage.geographic * 100).toFixed(0) : 0}% de cobertura geográfica e qualidade de fontes ${(data.result?.coverage?.temporal ? (data.result.coverage.temporal * 100).toFixed(0) : 0)}%.`}
            </p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="md:col-span-2 rounded-2xl border border-slate-800 overflow-hidden relative min-h-[300px] z-0">
          <div className="absolute top-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700 p-2 px-3 rounded-lg shadow-lg pointer-events-none">
             <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-0.5">Área Analisada</span>
             <span className="text-sm font-bold text-amber-500">{data.result?.granularity === 'coordinate' ? `Raio de ${radius}m` : 'Limite Municipal'}</span>
          </div>
          <MapContainer
            center={center}
            zoom={data.result?.granularity === 'coordinate' ? 14 : 11}
            style={{ height: "100%", width: "100%", zIndex: 0 }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {data.result?.granularity === 'coordinate' && (
              <Circle center={center} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.1 }} radius={parseFloat(radius)} />
            )}
            <MapUpdater center={center} zoom={data.result?.granularity === 'coordinate' ? 14 : 11} />
          </MapContainer>
        </motion.div>
      </div>

      {!isInsufficient && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <span className="text-sm font-medium text-slate-400 block mb-1">Total Analisado</span>
              <span className="text-3xl font-bold text-white block">{data.statistics.total}</span>
              <span className="text-xs text-slate-500">ocorrências no período</span>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <span className="text-sm font-medium text-slate-400 block mb-1">Furtos</span>
              <span className="text-2xl font-bold text-amber-400 block">{data.statistics.breakdown.thefts}</span>
              <span className="text-xs text-slate-500">{Math.round((data.statistics.breakdown.thefts / (data.statistics.total || 1)) * 100)}% do total</span>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <span className="text-sm font-medium text-slate-400 block mb-1">Roubos</span>
              <span className="text-2xl font-bold text-red-400 block">{data.statistics.breakdown.robberies}</span>
              <span className="text-xs text-slate-500">{Math.round((data.statistics.breakdown.robberies / (data.statistics.total || 1)) * 100)}% do total</span>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <span className="text-sm font-medium text-slate-400 block mb-1">Veículos</span>
              <span className="text-2xl font-bold text-blue-400 block">{data.statistics.breakdown.vehicles}</span>
              <span className="text-xs text-slate-500">{Math.round((data.statistics.breakdown.vehicles / (data.statistics.total || 1)) * 100)}% do total</span>
            </div>
          </div>
          
          <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" /> Comparação e Contexto
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
              Nesta área, predomina-se a categoria de {data.statistics.breakdown.robberies > data.statistics.breakdown.thefts ? 'Roubos' : 'Furtos'}. O nível de análise georreferenciada é <strong className="text-slate-300">{data.result?.granularity === 'coordinate' ? 'Exato (coordenadas no raio)' : (data.result?.granularity === 'municipality' ? 'Municipal (diluído na cidade)' : 'Estadual')}</strong>. A metodologia Vizinhança v{data.result?.methodology} processou {data.dataSources?.length || 0} banco(s) de dados públicos para chegar a esta conclusão.
            </p>
          </div>
        </>
      )}

      
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
                 <div className={`text-xl font-bold ${data.result.score > data.result.trend.previousScore ? "text-green-400" : (data.result.score < data.result.trend.previousScore ? "text-red-400" : "text-slate-400")}`}>
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


      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="pt-8 border-t border-slate-800/50">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-500" /> Fontes e Transparência
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              As análises são derivadas exclusivamente de cruzamentos matemáticos de Boletins de Ocorrência e Indicadores Governamentais importados oficialmente.
            </p>
            <ul className="space-y-3">
              {(data.dataSources || []).map((d: any) => (
                <li key={d.id} className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                  <div className="text-sm font-medium text-slate-200">{d.name} <span className="text-xs text-slate-500 ml-1">({d.provider})</span></div>
                  <div className="flex gap-4 mt-2">
                    <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">Índice Qualidade: {(d.qualityScore || d.quality_score || 0.9 * 100).toFixed(0)}%</span>
                    <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded" title="Baseada no pipeline de ingestão">Última leitura: {new Date(d.lastUpdatedAt || d.updatedAt || d.updated_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/50 self-start">
             <h4 className="text-xs font-bold text-slate-300 mb-2">⚠️ Limitações dos Dados</h4>
             <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4">
               <li>Dados oficias sofrem subnotificação crônica (nem todo crime é registrado).</li>
               {data.result?.granularity !== 'coordinate' && (
                 <li className="text-amber-500/90">A área buscada não possui coordenadas exatas cadastradas no sistema. O Score atual reflete a taxa do município como um todo.</li>
               )}
               <li>A ausência de dados pode significar falta de transparência local e não segurança plena.</li>
             </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
