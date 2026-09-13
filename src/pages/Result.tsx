import React from "react";
import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip, Popup } from "react-leaflet";
import { 
  ShieldCheck, ShieldAlert, Shield, AlertTriangle, MapPin, Activity, Search, Database, 
  GitCompare, BarChart3, Info, AlertCircle, FileText, Layers, Crosshair, Copy, Check,
  Calendar, Clock, Building2, Car, ExternalLink, ListFilter
} from "lucide-react";
import * as motion from "motion/react-client";
import { cn } from '../lib/utils.js';
import { MapUpdater } from '../components/MapUtils.js';
import { AiSummary } from '../components/AiSummary.js';

const InfoTooltip = ({ text }: { text: string }) => {
  return (
    <div className="group relative inline-flex items-center ml-1.5 cursor-help" tabIndex={0}>
      <Info className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 group-focus:text-slate-300 transition-colors" />
      <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus:opacity-100 group-focus:visible transition-all absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 text-xs text-slate-200 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 text-center pointer-events-none">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
      </div>
    </div>
  );
};

const getCategoryDetails = (category: string, sourceCategory?: string | null) => {
  const normCat = (category || '').toLowerCase();
  const normSrc = (sourceCategory || '').toUpperCase();

  if (normCat.includes('police_intervention') || normSrc.includes('INTERVENCAO') || normSrc.includes('INTERVENÇÃO') || normSrc.includes('MDIP')) {
    return {
      label: 'MDIP (Intervenção Policial)',
      color: '#a855f7',
      bgClass: 'bg-purple-950/60 text-purple-300 border-purple-800',
      badgeClass: 'bg-purple-500'
    };
  }
  if (normCat === 'homicide' || normSrc.includes('HOMICIDIO') || normSrc.includes('HOMICÍDIO') || normSrc.includes('LATROCINIO') || normSrc.includes('LATROCÍNIO')) {
    return {
      label: 'Homicídio / Latrocínio',
      color: '#ec4899',
      bgClass: 'bg-pink-950/60 text-pink-300 border-pink-800',
      badgeClass: 'bg-pink-500'
    };
  }
  if (normCat === 'vehicle_robbery' || (normSrc.includes('ROUBO') && normSrc.includes('VE'))) {
    return {
      label: 'Roubo de Veículo',
      color: '#0284c7',
      bgClass: 'bg-sky-950/60 text-sky-300 border-sky-800',
      badgeClass: 'bg-sky-500'
    };
  }
  if (normCat === 'vehicle_theft' || (normSrc.includes('FURTO') && normSrc.includes('VE')) || normSrc.includes('VEICULO') || normSrc.includes('VEÍCULO')) {
    return {
      label: 'Furto de Veículo',
      color: '#3b82f6',
      bgClass: 'bg-blue-950/60 text-blue-300 border-blue-800',
      badgeClass: 'bg-blue-500'
    };
  }
  if (normCat === 'cargo_theft' || normSrc.includes('CARGA')) {
    return {
      label: 'Roubo de Carga',
      color: '#6366f1',
      bgClass: 'bg-indigo-950/60 text-indigo-300 border-indigo-800',
      badgeClass: 'bg-indigo-500'
    };
  }
  if (normCat === 'robbery' || normSrc.includes('ROUBO')) {
    return {
      label: 'Roubo',
      color: '#ef4444',
      bgClass: 'bg-red-950/60 text-red-300 border-red-800',
      badgeClass: 'bg-red-500'
    };
  }
  if (normCat === 'theft' || normSrc.includes('FURTO')) {
    return {
      label: 'Furto',
      color: '#f59e0b',
      bgClass: 'bg-amber-950/60 text-amber-300 border-amber-800',
      badgeClass: 'bg-amber-500'
    };
  }
  if (normCat === 'bodily_harm' || normSrc.includes('LESAO') || normSrc.includes('LESÃO')) {
    return {
      label: 'Lesão Corporal',
      color: '#f97316',
      bgClass: 'bg-orange-950/60 text-orange-300 border-orange-800',
      badgeClass: 'bg-orange-500'
    };
  }
  if (normCat === 'drug_related' || normSrc.includes('DROGA') || normSrc.includes('TRAFICO') || normSrc.includes('TRÁFICO') || normSrc.includes('ENTORPECENTE')) {
    return {
      label: 'Entorpecentes / Drogas',
      color: '#10b981',
      bgClass: 'bg-emerald-950/60 text-emerald-300 border-emerald-800',
      badgeClass: 'bg-emerald-500'
    };
  }
  if (normCat === 'sexual_crime' || normSrc.includes('ESTUPRO') || normSrc.includes('SEXUAL')) {
    return {
      label: 'Crime Sexual',
      color: '#d946ef',
      bgClass: 'bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-800',
      badgeClass: 'bg-fuchsia-500'
    };
  }
  return {
    label: sourceCategory || 'Outras Ocorrências',
    color: '#94a3b8',
    bgClass: 'bg-slate-800/60 text-slate-300 border-slate-700',
    badgeClass: 'bg-slate-500'
  };
};

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
  const [showCustomYear, setShowCustomYear] = useState(period.match(/^\d{4}$/) !== null);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  // Estados de navegação no mapa e filtro de microdados
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [occurrenceSearch, setOccurrenceSearch] = useState<string>("");
  const [activePin, setActivePin] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set(key, value);
    navigate(`/resultado?${newParams.toString()}`);
  };

  useEffect(() => {
    if (!lat || !lon) return;
    
    setLoading(true);
    let effectivePeriod = period;
    if (period === "all_history") effectivePeriod = "all";

    fetch(`/api/analysis?lat=${lat}&lon=${lon}&radius=${radius}&period=${effectivePeriod}`)
      .then(async res => {
        if (!res.ok) {
           const text = await res.text();
           try {
             const json = JSON.parse(text);
             throw new Error(json.message || json.error || "Erro no servidor");
           } catch {
             throw new Error("Falha ao comunicar com o servidor");
           }
        }
        return res.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro na análise:", err);
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

  const copyCoordinates = (cLat: number, cLon: number, id: string) => {
    navigator.clipboard.writeText(`${cLat.toFixed(6)}, ${cLon.toFixed(6)}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Ocorrências filtradas para o mapa e tabela
  const filteredOccurrences = useMemo(() => {
    if (!data?.exactOccurrences || !Array.isArray(data.exactOccurrences)) return [];
    
    return data.exactOccurrences.filter((occ: any) => {
      // Validação estrita de coordenadas geográficas válidas
      const occLat = Number(occ.latitude);
      const occLon = Number(occ.longitude);
      if (isNaN(occLat) || isNaN(occLon) || !isFinite(occLat) || !isFinite(occLon)) {
        return false;
      }

      // Filtro de categoria
      if (selectedCategoryFilter !== "all") {
        const cat = (occ.category || '').toLowerCase();
        const src = (occ.sourceCategory || '').toUpperCase();

        if (selectedCategoryFilter === "robbery") {
          if (cat !== "robbery" && !src.includes("ROUBO")) return false;
        } else if (selectedCategoryFilter === "theft") {
          if (cat !== "theft" && !src.includes("FURTO")) return false;
        } else if (selectedCategoryFilter === "vehicle") {
          if (cat !== "vehicle_theft" && cat !== "vehicle_robbery" && !src.includes("VEICULO") && !src.includes("VEÍCULO") && !src.includes("AUTO")) return false;
        } else if (selectedCategoryFilter === "violent") {
          const isViolent = ["homicide", "bodily_harm", "police_intervention_death"].includes(cat) ||
            src.includes("HOMICIDIO") || src.includes("HOMICÍDIO") || src.includes("LATROCINIO") || src.includes("LATROCÍNIO") ||
            src.includes("INTERVENCAO") || src.includes("INTERVENÇÃO") || src.includes("MDIP") || src.includes("LESAO") || src.includes("LESÃO");
          if (!isViolent) return false;
        } else if (selectedCategoryFilter === "drugs") {
          if (cat !== "drug_related" && !src.includes("DROGA") && !src.includes("TRAFICO") && !src.includes("TRÁFICO") && !src.includes("ENTORPECENTE")) return false;
        }
      }

      // Filtro de busca textual
      if (occurrenceSearch.trim()) {
        const term = occurrenceSearch.toLowerCase();
        const matchBo = occ.boNumber?.toLowerCase().includes(term);
        const matchAddr = occ.address?.toLowerCase().includes(term);
        const matchBairro = occ.bairro?.toLowerCase().includes(term);
        const matchNat = (occ.sourceCategory || occ.subcategory || '').toLowerCase().includes(term);
        const matchDp = occ.delegacia?.toLowerCase().includes(term);
        if (!matchBo && !matchAddr && !matchBairro && !matchNat && !matchDp) return false;
      }

      return true;
    });
  }, [data?.exactOccurrences, selectedCategoryFilter, occurrenceSearch]);

  const safeCenter: [number, number] = useMemo(() => {
    const cLat = parseFloat(lat || "");
    const cLon = parseFloat(lon || "");
    if (!isNaN(cLat) && !isNaN(cLon) && isFinite(cLat) && isFinite(cLon)) {
      return [cLat, cLon];
    }
    return [-23.5505, -46.6333];
  }, [lat, lon]);

  const center: [number, number] = safeCenter;
  
  const targetMapCenter: [number, number] = useMemo(() => {
    if (activePin) {
      const pLat = Number(activePin.latitude);
      const pLon = Number(activePin.longitude);
      if (!isNaN(pLat) && !isNaN(pLon) && isFinite(pLat) && isFinite(pLon)) {
        return [pLat, pLon];
      }
    }
    return safeCenter;
  }, [activePin, safeCenter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 animate-pulse">Consultando dados oficiais e calculando indicadores...</p>
      </div>
    );
  }

  if (!data || data.error || !lat || !lon) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 max-w-md mx-auto text-center px-4">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-slate-200 mb-2">Não foi possível carregar os dados</h2>
        <p className="text-sm text-slate-400 mb-4">{data?.message || data?.error || "Verifique o endereço ou as coordenadas informadas."}</p>
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors">
          Voltar para a busca
        </button>
      </div>
    );
  }

  let scoreColor = "text-green-400";
  let bgScore = "bg-slate-900/50 border-slate-800";
  let Icon = ShieldCheck;
  const isInsufficient = data.score?.value === null || data.score?.classification === "Dados insuficientes";

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

  const confidenceValue = data.confidence?.value !== undefined ? (data.confidence.value * 100).toFixed(0) : 0;
  const geo = data.geographicIdentification || data.result?.geographicIdentification;
  const fallback = data.fallback || data.result?.fallback;

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto space-y-8 relative">
      <div className='absolute inset-0 opacity-10 pointer-events-none -z-10' style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)", backgroundSize: "40px 40px" }}></div>

      {/* Header com Identificação Geográfica */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-amber-500" />
            Resultado da Análise
          </h1>
          <p className="text-slate-300 text-sm line-clamp-1 max-w-lg font-medium">{address}</p>
          {geo && (
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-400">
              <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-slate-300 font-medium">
                {geo.municipalityName} - {geo.stateAcronym}
              </span>
              <span className="text-slate-500">Código IBGE: {geo.ibgeCode}</span>
              {typeof geo?.population === 'number' && (
                <span className="text-slate-500">• População: {geo.population.toLocaleString('pt-BR')} hab.</span>
              )}
              <span className="text-slate-500">• Coord: {parseFloat(lat).toFixed(4)}, {parseFloat(lon).toFixed(4)}</span>
            </div>
          )}
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
                placeholder={isComparing ? "Digite o 2º local para comparar..." : "Pesquisar outro local, CEP ou coordenadas..."}
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

      {/* Alerta Transparente de Fallback (se aplicável) */}
      {fallback?.used && (
        <div className="bg-sky-950/40 border border-sky-800/60 rounded-xl p-4 text-xs text-sky-200 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sky-300 block text-sm">Transparência: Fallback Geográfico Ativo</span>
            <p className="leading-relaxed text-sky-200">
              {fallback.reason || "Microdados pontuais georreferenciados para este raio não foram divulgados pela fonte oficial. A análise utilizou dados consolidados no nível municipal."}
            </p>
            <p className="text-[11px] text-sky-300/80">
              {fallback.disclosure}
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-slate-800 rounded-2xl p-4 shadow-xl border border-slate-700/50 flex flex-col md:flex-row gap-4 items-start md:items-center mb-8">
        {/* Filtro Período */}
        <div className="flex flex-col sm:flex-row w-full md:w-auto items-start sm:items-center gap-3">
          <label htmlFor="period-select" className="text-slate-400 text-sm font-medium whitespace-nowrap">
            Período:
          </label>
          <div className="flex flex-row w-full sm:w-auto gap-3">
            <div className="relative flex-1 sm:flex-none">
              <select
                id="period-select"
                value={showCustomYear ? 'custom' : period}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setShowCustomYear(true);
                  } else {
                    setShowCustomYear(false);
                    handleFilterChange('period', e.target.value);
                  }
                }}
                className="w-full appearance-none bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors cursor-pointer"
              >
                <option value="1w">Última Semana</option>
                <option value="1m">Último Mês</option>
                <option value="3m">Últimos 3 Meses</option>
                <option value="6m">Últimos 6 Meses</option>
                <option value="12m">Último Ano</option>
                <option value="all">Todo o Período</option>
                <option value="custom">Ano Específico...</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
            
            {showCustomYear && (
              <input
                id="custom-year"
                type="number"
                placeholder="Ex: 2024"
                autoFocus
                defaultValue={period.match(/^\d{4}$/) ? period : ""}
                onBlur={(e) => {
                  if (e.target.value.length === 4) handleFilterChange('period', e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.length === 4) handleFilterChange('period', e.currentTarget.value);
                }}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 w-24 flex-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors"
              />
            )}
          </div>
        </div>

        {/* Filtro Raio */}
        <div className="flex flex-col sm:flex-row w-full md:w-auto items-start sm:items-center gap-3">
          <label htmlFor="radius-select" className="text-slate-400 text-sm font-medium whitespace-nowrap flex items-center">
            Raio de Consulta:
            <InfoTooltip text={data.radius?.applied ? `Raio de ${radius}m aplicado diretamente às coordenadas.` : `A fonte oficial não possui microdados no raio de ${radius}m; agregando indicadores municipais.`} />
          </label>
          <div className="relative w-full sm:w-auto">
            <select
              id="radius-select"
              value={radius}
              onChange={(e) => handleFilterChange('radius', e.target.value)}
              className="w-full appearance-none bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors cursor-pointer"
            >
              <option value="500">500 metros</option>
              <option value="1000">1 quilômetro</option>
              <option value="2000">2 quilômetros</option>
              <option value="5000">5 quilômetros</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Período Efetivo */}
        {data.period?.label && (
          <div className="text-xs text-slate-400 ml-auto hidden lg:block">
            Série: <span className="text-slate-300 font-medium">{data.period.label}</span>
          </div>
        )}
      </div>

      {/* Regra Obrigatória: Alerta de Dados Insuficientes (Score Nulo, NUNCA Zero) */}
      {isInsufficient && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-2xl p-5 text-xs text-amber-200 flex items-start gap-3 shadow-lg">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <span className="font-bold text-amber-300 block text-sm">Diretriz de Integridade: Ausência de Registros Oficiais</span>
            <p className="leading-relaxed text-slate-300">
              {data.dataAbsenceNotice || "Ausência de dados não pode ser interpretada como ausência de crimes. A indisponibilidade de registros reflete falta de cobertura cadastral ou dados não divulgados pelo órgão responsável no período selecionado."}
            </p>
            <p className="text-amber-400 font-medium text-[11px]">
              O Safety Score permanece nulo (-) para preservar o rigor estatístico e evitar falsa sensação de segurança.
            </p>
          </div>
        </div>
      )}

      {/* Score & Mapa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className={cn("md:col-span-1 rounded-2xl p-6 border flex flex-col justify-center", bgScore)}>
          <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-4 flex items-center">
            Safety Score
            <InfoTooltip text="O Safety Score é um índice de 0 a 100 calculado com base na severidade penal e taxas demográficas/territoriais. Quando não há dados oficiais registrados, o score permanece nulo (-) e jamais assume valor zero." />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="stroke-current text-slate-800" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                {!isInsufficient && data.score?.value !== null && (
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
                {isInsufficient ? "Sem registros oficiais para cálculo" : `Escala de 0 (atenção máxima) a 100`}
              </div>
            </div>
          </div>
          
          {/* Confiança dos Dados */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 mt-2">
            <h3 className="text-xs font-bold text-slate-300 mb-1 flex items-center">
              Confiança dos Dados: {confidenceValue}%
              <InfoTooltip text="A confiança avalia exclusivamente a integridade, completude e recência dos dados oficiais fornecidos, e NÃO o nível de segurança do local." />
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isInsufficient
                 ? "Não há dados públicos oficiais suficientes cadastrados para gerar uma avaliação estatisticamente válida."
                 : `Baseado em dados com ${data.result?.coverage?.geographic ? (data.result.coverage.geographic * 100).toFixed(0) : 0}% de cobertura geográfica e precisão espacial ${data.result?.coverage?.spatial_precision === 'exact' ? 'pontual (coordenadas)' : 'agregada (nível municipal)'}.`}
            </p>
          </div>
        </motion.div>

        {/* Mapa Interativo com Pins Georreferenciados da SSP-SP */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="md:col-span-2 rounded-2xl border border-slate-800 overflow-hidden relative flex flex-col min-h-[460px] bg-slate-950">
          {/* Barra Superior do Mapa com Filtros de Categoria e Contadores */}
          <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 p-3 flex flex-wrap items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Mapa de Ocorrências (SSP-SP)
              </span>
              {data.exactOccurrences?.length > 0 && (
                <span className="bg-amber-500/10 text-amber-400 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/20">
                  {filteredOccurrences.length} de {data.exactOccurrences.length} pins
                </span>
              )}
            </div>

            {/* Filtro Rápido de Categorias no Mapa */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                  selectedCategoryFilter === "all" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                )}
              >
                Todos ({data.exactOccurrences?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter("robbery")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1",
                  selectedCategoryFilter === "robbery" ? "bg-red-500 text-white font-bold" : "bg-slate-800 text-red-300 hover:bg-slate-700"
                )}
              >
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                Roubos ({data.statistics?.breakdown?.robberies || 0})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter("theft")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1",
                  selectedCategoryFilter === "theft" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-amber-300 hover:bg-slate-700"
                )}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Furtos ({data.statistics?.breakdown?.thefts || 0})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter("vehicle")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1",
                  selectedCategoryFilter === "vehicle" ? "bg-blue-500 text-white font-bold" : "bg-slate-800 text-blue-300 hover:bg-slate-700"
                )}
              >
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                Veículos ({data.statistics?.breakdown?.vehicles || 0})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter("violent")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1",
                  selectedCategoryFilter === "violent" ? "bg-pink-600 text-white font-bold" : "bg-slate-800 text-pink-300 hover:bg-slate-700"
                )}
              >
                <span className="w-2 h-2 rounded-full bg-pink-400"></span>
                Violentos
              </button>
            </div>
          </div>

          {/* Container do Mapa Leaflet */}
          <div className="relative flex-1 min-h-[380px] z-0">
            <MapContainer
              center={center}
              zoom={data.granularity === 'coordinate' ? 15 : 12}
              style={{ height: "100%", width: "100%", zIndex: 0 }}
              zoomControl={false}
            >
              <TileLayer
                attribution={(import.meta as any).env.VITE_MAPBOX_TOKEN ? '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a>' : 'Powered by <a href="https://www.esri.com/">Esri</a>'}
                url={(import.meta as any).env.VITE_MAPBOX_TOKEN ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${(import.meta as any).env.VITE_MAPBOX_TOKEN}` : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'}
              />

              {/* Raio de Abrangência */}
              {data.granularity === 'coordinate' && (
                <Circle 
                  center={center} 
                  pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.08, weight: 1.5, dashArray: '4, 6' }} 
                  radius={parseFloat(radius)} 
                />
              )}

              {/* Marcador Central do Endereço Consultado */}
              <CircleMarker
                center={center}
                radius={8}
                pathOptions={{ color: '#ffffff', fillColor: '#3b82f6', fillOpacity: 1, weight: 3 }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                  <div className="font-bold text-xs text-slate-900">
                    📍 Endereço Consultado
                  </div>
                  <div className="text-[10px] text-slate-600 max-w-xs truncate">
                    {address}
                  </div>
                </Tooltip>
              </CircleMarker>

              {/* Pins de Ocorrências Reais com Coordenadas Exatas (SSP-SP) */}
              {filteredOccurrences.map((occ: any, index: number) => {
                const details = getCategoryDetails(occ.category, occ.sourceCategory);
                const isSelected = activePin?.id === occ.id || (activePin?.latitude === occ.latitude && activePin?.longitude === occ.longitude);

                return (
                  <CircleMarker 
                    key={occ.id || index}
                    center={[occ.latitude, occ.longitude]}
                    radius={isSelected ? 9 : 6}
                    pathOptions={{ 
                      color: isSelected ? '#ffffff' : '#0f172a', 
                      fillColor: details.color, 
                      fillOpacity: 0.95, 
                      weight: isSelected ? 3 : 1.5 
                    }}
                    eventHandlers={{
                      click: () => setActivePin(occ)
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: details.color }}></span>
                        {details.label}
                      </div>
                      {occ.sourceCategory && occ.sourceCategory !== details.label && (
                        <div className="text-[10px] text-slate-700 font-medium">
                          {occ.sourceCategory}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {occ.date ? new Date(occ.date).toLocaleDateString('pt-BR') : ''} {occ.time ? `• ${occ.time}` : ''}
                      </div>
                      {occ.boNumber && (
                        <div className="text-[9px] text-slate-400 font-mono">
                          BO: {occ.boNumber}{occ.boYear ? `/${occ.boYear}` : ''}
                        </div>
                      )}
                    </Tooltip>

                    <Popup className="custom-popup">
                      <div className="p-1 max-w-xs text-slate-900">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5 mb-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: details.color }}>
                            {details.label}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            SSP-SP
                          </span>
                        </div>

                        {occ.sourceCategory && (
                          <div className="text-xs font-semibold text-slate-800 mb-1">
                            {occ.sourceCategory}
                          </div>
                        )}

                        {occ.subcategory && (
                          <div className="text-[11px] text-slate-600 mb-2 italic">
                            Rubrica: {occ.subcategory}
                          </div>
                        )}

                        <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-1.5">
                          {occ.boNumber && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-medium">Boletim (BO):</span>
                              <span className="font-mono font-bold text-slate-800">{occ.boNumber}{occ.boYear ? `/${occ.boYear}` : ''}</span>
                            </div>
                          )}

                          {occ.date && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-medium">Data do Fato:</span>
                              <span className="text-slate-800">{new Date(occ.date).toLocaleDateString('pt-BR')} {occ.time ? `às ${occ.time}` : ''}</span>
                            </div>
                          )}

                          {occ.address && (
                            <div className="pt-1">
                              <span className="text-slate-400 font-medium block">Local:</span>
                              <span className="text-slate-800 leading-tight block">{occ.address}</span>
                            </div>
                          )}

                          {occ.delegacia && (
                            <div className="pt-0.5">
                              <span className="text-slate-400 font-medium block">Delegacia (DP):</span>
                              <span className="text-slate-700 leading-tight block">{occ.delegacia}</span>
                            </div>
                          )}

                          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 mt-2">
                            <span className="text-[10px] text-slate-400 font-mono">
                              {occ.latitude.toFixed(5)}, {occ.longitude.toFixed(5)}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyCoordinates(occ.latitude, occ.longitude, occ.id || `${occ.latitude}`)}
                              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium transition-colors flex items-center gap-1"
                            >
                              {copiedId === (occ.id || `${occ.latitude}`) ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              Copiar GPS
                            </button>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}

              <MapUpdater center={targetMapCenter} zoom={data.granularity === 'coordinate' ? 15 : 12} />
            </MapContainer>
          </div>

          {/* Legenda do Mapa */}
          <div className="bg-slate-900/95 border-t border-slate-800 p-2.5 px-4 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Legenda:</span>
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Roubo
              </span>
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Furto
              </span>
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Veículo
              </span>
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span> Homicídio / MDIP
              </span>
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 border border-white"></span> Local Consultado
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Clique em qualquer pin para inspecionar Boletim e coordenadas
            </div>
          </div>
        </motion.div>
      </div>

      {/* Indicadores Estatísticos */}
      {!isInsufficient && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <span className="text-sm font-medium text-slate-400 block mb-1">Total Analisado</span>
              <span className="text-3xl font-bold text-white block">{data.statistics.total}</span>
              <span className="text-xs text-slate-500">registros oficiais</span>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <span className="text-sm font-medium text-slate-400 mb-1 flex items-center">
                Furtos
                <InfoTooltip text="Subtração de bens sem o uso de violência ou grave ameaça à vítima." />
              </span>
              <span className="text-2xl font-bold text-amber-400 block">{data.statistics.breakdown.thefts}</span>
              <span className="text-xs text-slate-500">{Math.round((data.statistics.breakdown.thefts / (data.statistics.total || 1)) * 100)}% do total</span>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <span className="text-sm font-medium text-slate-400 mb-1 flex items-center">
                Roubos
                <InfoTooltip text="Subtração de bens com emprego de violência ou grave ameaça à vítima." />
              </span>
              <span className="text-2xl font-bold text-red-400 block">{data.statistics.breakdown.robberies}</span>
              <span className="text-xs text-slate-500">{Math.round((data.statistics.breakdown.robberies / (data.statistics.total || 1)) * 100)}% do total</span>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <span className="text-sm font-medium text-slate-400 mb-1 flex items-center">
                Veículos
                <InfoTooltip text="Ocorrências de furtos e roubos que envolvem especificamente veículos automotores." />
              </span>
              <span className="text-2xl font-bold text-blue-400 block">{data.statistics.breakdown.vehicles}</span>
              <span className="text-xs text-slate-500">{Math.round((data.statistics.breakdown.vehicles / (data.statistics.total || 1)) * 100)}% do total</span>
            </div>
          </div>
          
          <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" /> Contexto e Fatores de Influência
            </h3>
            <div className="space-y-2">
              <p className="text-sm text-slate-300 leading-relaxed">
                Nesta região, predomina a categoria de <strong>{data.statistics.breakdown.robberies > data.statistics.breakdown.thefts ? 'Roubos (crimes violentos)' : 'Furtos (crimes patrimoniais)'}</strong>.
                A precisão espacial é classificada como <strong className="text-amber-400">{data.granularity === 'coordinate' ? 'Exata (pontos no raio de ' + radius + 'm)' : 'Agregada (nível municipal)'}</strong>.
              </p>
              {data.factors && data.factors.length > 0 && (
                <ul className="text-xs text-slate-400 list-disc pl-5 space-y-1 pt-2">
                  {data.factors.map((factor: string, idx: number) => (
                    <li key={idx}>{factor}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tabela / Lista Interativa de Ocorrências Pontuais com Coordenadas */}
      {(data.exactOccurrences?.length || 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ListFilter className="w-5 h-5 text-amber-500" />
                Microdados Georreferenciados no Raio ({filteredOccurrences.length} de {data.exactOccurrences.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ocorrências oficiais da SSP-SP com latitude e longitude exatas extraídas diretamente dos Boletins de Ocorrência.
              </p>
            </div>

            {/* Input de filtro textual */}
            <div className="relative w-full md:w-72">
              <input
                type="text"
                placeholder="Filtrar por BO, rua, bairro, delito..."
                value={occurrenceSearch}
                onChange={(e) => setOccurrenceSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Grid de Cards de Ocorrências */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
            {filteredOccurrences.map((occ: any, idx: number) => {
              const details = getCategoryDetails(occ.category, occ.sourceCategory);
              const isSelected = activePin?.id === occ.id || (activePin?.latitude === occ.latitude && activePin?.longitude === occ.longitude);

              return (
                <div
                  key={occ.id || idx}
                  onClick={() => setActivePin(occ)}
                  className={cn(
                    "p-3.5 rounded-xl border text-xs transition-all cursor-pointer flex flex-col justify-between space-y-2",
                    isSelected 
                      ? "bg-slate-800/90 border-amber-500 shadow-lg ring-1 ring-amber-500/50" 
                      : "bg-slate-900/60 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", details.bgClass)}>
                      {details.label}
                    </span>
                    {occ.boNumber && (
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                        BO: {occ.boNumber}{occ.boYear ? `/${occ.boYear}` : ''}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-slate-200 leading-snug truncate" title={occ.sourceCategory}>
                      {occ.sourceCategory || details.label}
                    </div>
                    {occ.subcategory && (
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {occ.subcategory}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                    {occ.address && (
                      <div className="flex items-start gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span className="truncate">{occ.address}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {occ.date ? new Date(occ.date).toLocaleDateString('pt-BR') : 'Data n/d'}
                      </span>
                      {occ.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {occ.time}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/50 text-[10px]">
                    <span className="text-slate-500 font-mono">
                      {occ.latitude.toFixed(4)}, {occ.longitude.toFixed(4)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePin(occ);
                      }}
                      className="text-amber-400 hover:text-amber-300 font-medium"
                    >
                      {isSelected ? "Focado no Mapa ✓" : "Ver no Mapa →"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Comparação com período anterior & Resumo com IA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-500" /> Comparação com Período Anterior
          </h3>
          {data.trend?.previousScore !== undefined && data.trend?.previousScore !== null ? (
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <span className="text-sm text-slate-400">Score Anterior</span>
                 <span className="text-lg font-bold text-slate-300">{data.trend.previousScore}</span>
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-sm text-slate-400">Score Atual</span>
                 <span className="text-lg font-bold text-white">{data.score.value}</span>
               </div>
               <div className="pt-4 border-t border-slate-800/50 flex items-center gap-4">
                 <div className={`text-xl font-bold ${data.score.value > data.trend.previousScore ? "text-green-400" : (data.score.value < data.trend.previousScore ? "text-red-400" : "text-slate-400")}`}>
                   {data.score.value > data.trend.previousScore ? '↑' : (data.score.value < data.trend.previousScore ? '↓' : '↔')} {Math.abs(data.score.value - data.trend.previousScore)} pontos
                 </div>
               </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 leading-relaxed">
              Não há dados históricos anteriores suficientes nesta região para calcular uma tendência estatisticamente válida.
            </p>
          )}
        </motion.div>
        
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
           <AiSummary data={data} />
        </motion.div>
      </div>

      {/* Fontes, Metodologia e Limitações */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="pt-8 border-t border-slate-800/50">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-500" /> Fontes Oficiais e Metodologia
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              As análises são derivadas exclusivamente de cruzamentos matemáticos de Boletins de Ocorrência e Indicadores Governamentais importados oficialmente.
            </p>
            <ul className="space-y-3">
              {(data.dataSources || []).map((d: any) => (
                <li key={d.id} className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                  <div className="text-sm font-medium text-slate-200">
                    {d.name} <span className="text-xs text-slate-500 ml-1">({d.provider})</span>
                    {d.isFallback && (
                      <span className="ml-2 text-[10px] bg-sky-900/60 text-sky-300 px-2 py-0.5 rounded border border-sky-800">Fallback</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Índice Qualidade: {((d.qualityScore || d.quality_score || 0.85) * 100).toFixed(0)}%</span>
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded" title="Data do último registro importado">Atualizado em: {new Date(d.updated_at || d.updatedAt || new Date()).toLocaleDateString('pt-BR')}</span>
                  </div>
                </li>
              ))}
            </ul>
            {data.methodology && (
              <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
                <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <span><strong>Metodologia:</strong> {data.methodology}</span>
              </div>
            )}
          </div>

          <div className="bg-slate-900/30 p-5 rounded-xl border border-slate-800/50 self-start">
             <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">⚠️ Limitações Estatísticas dos Dados</h4>
             <ul className="text-xs text-slate-400 space-y-2.5 list-disc pl-4 leading-relaxed">
               <li><strong>Subnotificação crônica:</strong> apenas ocorrências formalmente registradas pelas polícias estaduais constam nas estatísticas oficiais.</li>
               <li><strong>Ausência de registros:</strong> a ausência de dados pode significar falta de publicação ou de cobertura cadastral e NÃO deve ser interpretada como inexistência de crimes.</li>
               {data.granularity !== 'coordinate' && (
                 <li className="text-amber-400/90"><strong>Granularidade agregada:</strong> microdados pontuais com coordenadas no raio solicitado não estavam disponíveis. Os dados refletem o município como um todo.</li>
               )}
               <li><strong>Ciclos governamentais:</strong> os registros dependem do cronograma de divulgação pública de cada secretaria de segurança.</li>
             </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
