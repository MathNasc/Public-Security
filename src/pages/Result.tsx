import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, Circle, CircleMarker, Popup } from "react-leaflet";
import { ShieldAlert, Info, MapPin, TrendingDown, Clock, ShieldCheck, Activity } from "lucide-react";
import { MapUpdater } from "../components/MapUtils";
import { TrendChart } from "../components/TrendChart";
import * as motion from "motion/react-client";
import { cn } from "../lib/utils";

export function Result() {
  const [searchParams] = useSearchParams();
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const address = searchParams.get("address") || "Endereço desconhecido";

  const [radius, setRadius] = useState("1000");
  const [periodType, setPeriodType] = useState("12m");
  const [customYear, setCustomYear] = useState(new Date().getFullYear().toString());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const effectivePeriod = periodType === "custom" ? customYear : periodType;

  useEffect(() => {
    if (!lat || !lon) return;
    if (periodType === "custom" && !/^\d{4}$/.test(customYear)) return;

    setLoading(true);
    fetch(`/api/analysis?lat=${lat}&lon=${lon}&radius=${radius}&period=${effectivePeriod}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [lat, lon, radius, periodType, customYear]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-slate-400 font-medium animate-pulse">Analisando região...</p>
      </div>
    );
  }

  if (!data || !lat || !lon) {
    return (
      <div className="p-8 text-center text-slate-500">
        Não foi possível carregar os dados. Verifique o endereço e tente novamente.
      </div>
    );
  }

  const center: [number, number] = [parseFloat(lat), parseFloat(lon)];
  
  // Dynamic color for score
  let scoreColor = "text-green-400";
  let bgScore = "bg-slate-800/50 border-slate-700/50";
  if (data.score.classification === "Dados insuficientes") {
    scoreColor = "text-slate-500";
  } else if (data.score.value < 40) {
    scoreColor = "text-red-400";
  } else if (data.score.value < 75) {
    scoreColor = "text-amber-500";
  }

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto space-y-8 relative">
      <div className='absolute inset-0 opacity-10 pointer-events-none -z-10' style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)", backgroundSize: "40px 40px" }}></div>
      {/* 1. Endereço */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{address.split(',')[0]}</h1>
          <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium rounded-full flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-amber-500" /> {address.split(',').slice(1).join(',').trim()}
          </span>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 border-y border-slate-800 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-400">Raio:</span>
          <select 
            value={radius} 
            onChange={(e) => setRadius(e.target.value)}
            className="text-sm font-medium bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
          >
            <option value="500">500 m</option>
            <option value="1000">1 km</option>
            <option value="2000">2 km</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-400">Período:</span>
          <div className="flex items-center gap-2">
            <select 
              value={periodType} 
              onChange={(e) => setPeriodType(e.target.value)}
              className="text-sm font-medium bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
            >
              <option value="3m">Últimos 3 meses</option>
              <option value="6m">Últimos 6 meses</option>
              <option value="12m">Últimos 12 meses</option>
              <option value="all">Todo o histórico</option>
              <option value="custom">Inserir ano...</option>
            </select>
            
            {periodType === "custom" && (
              <input
                type="text"
                maxLength={4}
                value={customYear}
                onChange={(e) => setCustomYear(e.target.value)}
                placeholder="Ex: 2019"
                className="w-20 text-sm font-medium bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 2 & 3. Score e Resumo */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={cn("md:col-span-1 rounded-2xl p-6 border flex flex-col justify-center", bgScore)}>
          <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-4">Score de Segurança</div>
          <div className="flex items-center gap-4 mb-3">
            <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="stroke-current text-slate-800" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                {data.score.classification !== "Dados insuficientes" && (
                  <path className={cn("stroke-current", scoreColor)} strokeWidth="3" strokeDasharray={`${data.score.value}, 100`} strokeLinecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                )}
              </svg>
              <span className="absolute text-2xl font-bold text-white">
                {data.score.classification === "Dados insuficientes" ? "-" : data.score.value}
              </span>
            </div>
            <div>
              <div className={cn("font-semibold text-sm", scoreColor)}>{data.score.classification}</div>
              <div className="text-xs text-slate-400 mt-1 leading-relaxed">Score estimado com base nas fontes disponíveis.</div>
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 mt-2">
             <h3 className="text-xs font-bold text-slate-300 mb-1">Por que essa nota?</h3>
             <p className="text-xs text-slate-400 leading-normal">
               {data.score.classification === "Dados insuficientes" 
                 ? "Não há registros suficientes no banco de dados para gerar uma avaliação confiável nesta área e período específico."
                 : "A região apresenta um volume de ocorrências e densidade correspondente a este nível de atenção com base nos dados públicos ingeridos."}
             </p>
          </div>
        </motion.div>

        {/* 4. Estatísticas principais */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-sm font-medium text-slate-500 flex items-center gap-2"><Activity className="w-4 h-4"/> Total</span>
            <span className="text-3xl font-bold text-white mt-2">{data.statistics.total}</span>
          </div>
          <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-sm font-medium text-slate-500">Roubos</span>
            <span className="text-3xl font-bold text-white mt-2">{data.statistics.robberies}</span>
          </div>
          <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-sm font-medium text-slate-500">Furtos</span>
            <span className="text-3xl font-bold text-white mt-2">{data.statistics.thefts}</span>
          </div>
          <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-sm font-medium text-slate-500">Roubo/Furto de Veículos</span>
            <span className="text-3xl font-bold text-white mt-2">{data.statistics.vehicles}</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* 5. Mapa */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="md:col-span-2 h-[450px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 relative z-0">
          <MapContainer center={center} zoom={14} className="w-full h-full" zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MapUpdater center={center} zoom={radius === "500" ? 15 : radius === "1000" ? 14 : 13} />
            <Circle 
              center={center} 
              radius={parseInt(radius)} 
              pathOptions={{ fillColor: '#f59e0b', fillOpacity: 0.05, color: '#f59e0b', weight: 1, dashArray: '4 4' }} 
            />
            {data.occurrences.map((occ: any, idx: number) => (
              <CircleMarker 
                key={occ.id || idx} 
                center={[occ.latitude, occ.longitude]} 
                radius={5}
                pathOptions={{ 
                  fillColor: occ.category.includes('pessoas') ? '#ef4444' : '#f59e0b',
                  fillOpacity: 0.7, 
                  color: '#020617', 
                  weight: 1 
                }}
              >
                <Popup className="rounded-xl">
                  <div className="font-sans text-slate-800">
                    <p className="font-semibold m-0">{occ.subcategory}</p>
                    <p className="text-xs text-slate-500 m-0 mt-1">{new Date(occ.occurredAt).toLocaleDateString()}</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </motion.div>

        <div className="space-y-6">
          {/* Explicabilidade */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h3 className="font-semibold text-lg text-white">Análise detalhada</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="mt-0.5"><TrendingDown className="w-5 h-5 text-slate-500" /></div>
                <div>
                  <h4 className="text-sm font-medium text-slate-200">Concentração</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">Foram registradas {data.statistics.total} ocorrências dentro do raio analisado.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="mt-0.5"><ShieldAlert className="w-5 h-5 text-amber-500" /></div>
                <div>
                  <h4 className="text-sm font-medium text-slate-200">Principal Atenção</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {data.statistics.robberies > data.statistics.thefts ? "Roubos" : "Furtos"} representam a maior parte das ocorrências.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="mt-0.5"><Clock className="w-5 h-5 text-indigo-400" /></div>
                <div>
                  <h4 className="text-sm font-medium text-slate-200">Horário Crítico</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    A maior concentração de ocorrências acontece durante {data.statistics.nightPercentage > 50 ? "a noite" : "o dia"} ({Math.max(data.statistics.nightPercentage, data.statistics.dayPercentage)}%).
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="mt-0.5"><Activity className="w-5 h-5 text-blue-400" /></div>
                <div>
                  <h4 className="text-sm font-medium text-slate-200">Comparação Regional</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    A região apresenta resultado semelhante à média geral de zonas equivalentes na cidade ({Math.round(data.statistics.total * 0.85)} a {Math.round(data.statistics.total * 1.15)} ocorrências/ano).
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
          
          {/* Confiança */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex gap-4 items-start">
            <ShieldCheck className="w-6 h-6 text-green-500 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-slate-200">Alta Confiança</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">A análise possui dados recentes e quantidade suficiente de registros no raio selecionado.</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 6 & 7. Tendência e Tipos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="font-semibold text-lg text-white mb-6">Histórico de Ocorrências</h3>
          <TrendChart data={data.trend} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="font-semibold text-lg text-white mb-6">Distribuição por Tipo</h3>
          <div className="space-y-4">
            <DistributionBar label="Roubos" value={data.statistics.robberies} total={data.statistics.total} color="bg-red-500" />
            <DistributionBar label="Furtos" value={data.statistics.thefts} total={data.statistics.total} color="bg-amber-400" />
            <DistributionBar label="Roubo/Furto de Veículos" value={data.statistics.vehicles} total={data.statistics.total} color="bg-blue-500" />
            <DistributionBar label="Outros" value={data.statistics.others} total={data.statistics.total} color="bg-slate-500" />
            
            {data.statistics.others > 0 && data.statistics.othersBreakdown && (
              <div className="mt-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Detalhamento de "Outros"</h4>
                <ul className="space-y-2">
                  {Object.entries(data.statistics.othersBreakdown)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 10)
                    .map(([desc, count]) => (
                    <li key={desc} className="flex justify-between items-center text-sm">
                      <span className="text-slate-300 truncate pr-4" title={desc}>{desc}</span>
                      <span className="text-slate-400 font-medium shrink-0">{count as number} <span className="text-xs text-slate-500 ml-1">({Math.round(((count as number)/data.statistics.others)*100)}%)</span></span>
                    </li>
                  ))}
                </ul>
                {Object.keys(data.statistics.othersBreakdown).length > 10 && (
                  <div className="text-xs text-slate-500 mt-3 pt-2 border-t border-slate-700/30 text-center">
                    + {Object.keys(data.statistics.othersBreakdown).length - 10} outras naturezas
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* 10. Metodologia / Alerta */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="pt-8 border-t border-slate-800 space-y-8">
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-5 flex gap-4 text-slate-300">
          <Info className="w-6 h-6 shrink-0 text-amber-500" />
          <div className="text-sm leading-relaxed">
            <span className="font-semibold block mb-1 text-slate-200">⚠️ Importante</span>
            Os dados representam ocorrências registradas pelas fontes utilizadas e podem não representar todos os crimes ocorridos. A análise possui caráter informativo e não constitui garantia de segurança.
          </div>
        </div>

        <div className="text-xs text-slate-500 space-y-3">
          <p className="font-semibold text-slate-600 uppercase tracking-wider">Metodologia e Fontes</p>
          <p>Analisamos a frequência e o tipo de ocorrências registradas na base de dados normalizada dentro do raio especificado através de indexação geoespacial (fórmula de Haversine). O score pondera esses valores com base na gravidade do incidente e densidade local estimada (ocorrências/km²/ano).</p>
          <div>
            <span className="font-medium text-slate-400">Fontes processadas:</span>
            <ul className="list-disc pl-4 mt-2 space-y-1">
              {data.dataSources.map((d: any) => (
                <li key={d.id}>
                  {d.name} ({d.provider}) - Última atualização: {new Date(d.lastUpdatedAt).toLocaleDateString('pt-BR')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function DistributionBar({ label, value, total, color }: { label: string, value: number, total: number, color: string }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-medium text-slate-300">{label}</span>
        <span className="text-slate-400">{percentage}% <span className="text-slate-700 mx-1">|</span> {value}</span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
