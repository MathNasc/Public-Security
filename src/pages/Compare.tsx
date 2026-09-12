import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Shield, 
  AlertTriangle, 
  MapPin, 
  Activity, 
  Search, 
  Navigation, 
  Loader2, 
  GitCompare, 
  ArrowRightLeft, 
  Check, 
  X,
  Sparkles
} from "lucide-react";
import * as motion from "motion/react-client";
import { cn } from '../lib/utils.js';

interface AddressLocation {
  address: string;
  lat: number | null;
  lon: number | null;
}

const POPULAR_PRESETS = [
  {
    name: "SP: Paulista vs. Moema",
    loc1: { address: "Av. Paulista - Bela Vista, São Paulo, SP", lat: -23.5615, lon: -46.6560 },
    loc2: { address: "Moema, São Paulo, SP", lat: -23.6041, lon: -46.6663 }
  },
  {
    name: "RJ: Copacabana vs. Barra",
    loc1: { address: "Copacabana, Rio de Janeiro, RJ", lat: -22.9694, lon: -43.1868 },
    loc2: { address: "Barra da Tijuca, Rio de Janeiro, RJ", lat: -23.0003, lon: -43.3659 }
  },
  {
    name: "MG: Savassi vs. Centro (BH)",
    loc1: { address: "Savassi, Belo Horizonte, MG", lat: -19.9386, lon: -43.9331 },
    loc2: { address: "Centro, Belo Horizonte, MG", lat: -19.9191, lon: -43.9386 }
  },
  {
    name: "PR: Batel vs. Centro (Curitiba)",
    loc1: { address: "Batel, Curitiba, PR", lat: -25.4431, lon: -49.2842 },
    loc2: { address: "Centro, Curitiba, PR", lat: -25.4325, lon: -49.2711 }
  }
];

export function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read initial params from URL if present
  const paramLat1 = searchParams.get("lat1");
  const paramLon1 = searchParams.get("lon1");
  const paramAddr1 = searchParams.get("address1");

  const paramLat2 = searchParams.get("lat2");
  const paramLon2 = searchParams.get("lon2");
  const paramAddr2 = searchParams.get("address2");

  // State for Location 1
  const [loc1, setLoc1] = useState<AddressLocation>({
    address: paramAddr1 || "",
    lat: paramLat1 ? parseFloat(paramLat1) : null,
    lon: paramLon1 ? parseFloat(paramLon1) : null
  });
  const [query1, setQuery1] = useState(paramAddr1 || "");
  const [suggestions1, setSuggestions1] = useState<any[]>([]);
  const [loading1, setLoading1] = useState(false);
  const [geoLoading1, setGeoLoading1] = useState(false);

  // State for Location 2
  const [loc2, setLoc2] = useState<AddressLocation>({
    address: paramAddr2 || "",
    lat: paramLat2 ? parseFloat(paramLat2) : null,
    lon: paramLon2 ? parseFloat(paramLon2) : null
  });
  const [query2, setQuery2] = useState(paramAddr2 || "");
  const [suggestions2, setSuggestions2] = useState<any[]>([]);
  const [loading2, setLoading2] = useState(false);
  const [geoLoading2, setGeoLoading2] = useState(false);

  // Data fetching state
  const [data1, setData1] = useState<any>(null);
  const [data2, setData2] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Sync state with URL params
  useEffect(() => {
    if (paramLat1 && paramLon1 && paramAddr1) {
      setLoc1({ address: paramAddr1, lat: parseFloat(paramLat1), lon: parseFloat(paramLon1) });
      setQuery1(paramAddr1);
    }
    if (paramLat2 && paramLon2 && paramAddr2) {
      setLoc2({ address: paramAddr2, lat: parseFloat(paramLat2), lon: parseFloat(paramLon2) });
      setQuery2(paramAddr2);
    }
  }, [paramLat1, paramLon1, paramAddr1, paramLat2, paramLon2, paramAddr2]);

  // Execute comparison when both locations are populated
  useEffect(() => {
    if (loc1.lat !== null && loc1.lon !== null && loc2.lat !== null && loc2.lon !== null) {
      setAnalyzing(true);
      setFetchError(null);

      Promise.all([
        fetch(`/api/analysis?lat=${loc1.lat}&lon=${loc1.lon}&radius=1000&period=12m`).then(r => r.json()),
        fetch(`/api/analysis?lat=${loc2.lat}&lon=${loc2.lon}&radius=1000&period=12m`).then(r => r.json())
      ]).then(([res1, res2]) => {
        if (res1.error || res2.error) {
          setFetchError(res1.error || res2.error || "Erro ao buscar dados das regiões.");
        } else {
          setData1(res1);
          setData2(res2);
        }
        setAnalyzing(false);
      }).catch(err => {
        console.error("Comparison fetch error:", err);
        setFetchError("Falha na conexão ao carregar análise comparativa.");
        setAnalyzing(false);
      });
    } else {
      setData1(null);
      setData2(null);
    }
  }, [loc1.lat, loc1.lon, loc2.lat, loc2.lon]);

  // Geocoding search helper for Location 1
  const handleSearchLoc1 = async (q: string) => {
    if (!q.trim()) return;
    setLoading1(true);
    try {
      const res = await fetch(`/api/geocode?query=${encodeURIComponent(q)}`);
      const results = await res.json();
      setSuggestions1(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading1(false);
    }
  };

  // Geocoding search helper for Location 2
  const handleSearchLoc2 = async (q: string) => {
    if (!q.trim()) return;
    setLoading2(true);
    try {
      const res = await fetch(`/api/geocode?query=${encodeURIComponent(q)}`);
      const results = await res.json();
      setSuggestions2(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading2(false);
    }
  };

  const handleSelectLoc1 = (item: any) => {
    const newLoc = {
      address: item.formattedAddress,
      lat: item.latitude,
      lon: item.longitude
    };
    setLoc1(newLoc);
    setQuery1(item.formattedAddress);
    setSuggestions1([]);
    updateUrlParams(newLoc, loc2);
  };

  const handleSelectLoc2 = (item: any) => {
    const newLoc = {
      address: item.formattedAddress,
      lat: item.latitude,
      lon: item.longitude
    };
    setLoc2(newLoc);
    setQuery2(item.formattedAddress);
    setSuggestions2([]);
    updateUrlParams(loc1, newLoc);
  };

  const handleGeolocate = (target: 1 | 2) => {
    if (!navigator.geolocation) {
      alert("Geolocalização não suportada no seu navegador.");
      return;
    }
    const setLoading = target === 1 ? setGeoLoading1 : setGeoLoading2;
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let addr = "Minha Localização";
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, {
            headers: { 'User-Agent': 'PublicSecurity/1.0' }
          });
          const d = await res.json();
          if (d.display_name) addr = d.display_name;
        } catch (e) {
          // ignore
        }

        const newLoc = { address: addr, lat: latitude, lon: longitude };
        if (target === 1) {
          setLoc1(newLoc);
          setQuery1(addr);
          updateUrlParams(newLoc, loc2);
        } else {
          setLoc2(newLoc);
          setQuery2(addr);
          updateUrlParams(loc1, newLoc);
        }
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        alert("Não foi possível acessar sua localização.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const updateUrlParams = (l1: AddressLocation, l2: AddressLocation) => {
    const params = new URLSearchParams();
    if (l1.lat !== null && l1.lon !== null && l1.address) {
      params.set("lat1", l1.lat.toString());
      params.set("lon1", l1.lon.toString());
      params.set("address1", l1.address);
    }
    if (l2.lat !== null && l2.lon !== null && l2.address) {
      params.set("lat2", l2.lat.toString());
      params.set("lon2", l2.lon.toString());
      params.set("address2", l2.address);
    }
    setSearchParams(params);
  };

  const applyPreset = (preset: typeof POPULAR_PRESETS[0]) => {
    setLoc1(preset.loc1);
    setQuery1(preset.loc1.address);
    setLoc2(preset.loc2);
    setQuery2(preset.loc2.address);
    updateUrlParams(preset.loc1, preset.loc2);
  };

  const clearLoc1 = () => {
    setLoc1({ address: "", lat: null, lon: null });
    setQuery1("");
    setSuggestions1([]);
  };

  const clearLoc2 = () => {
    setLoc2({ address: "", lat: null, lon: null });
    setQuery2("");
    setSuggestions2([]);
  };

  const isComparable = data1 && data2 && 
    data1.result?.granularity === data2.result?.granularity && 
    data1.result?.methodology === data2.result?.methodology;

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto space-y-8">
      {/* Title Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <GitCompare className="w-4 h-4 text-amber-500" />
          Análise Comparativa Regional
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          Comparar Histórico de Segurança
        </h1>
        <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
          Digite dois endereços para analisar e comparar o nível de criminalidade, taxa de criminalidade e tipos de ocorrência lado a lado.
        </p>
      </div>

      {/* Dual Address Search Inputs Box */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <Search className="w-4 h-4 text-amber-500" />
            Selecione os Dois Endereços
          </h2>
          <span className="text-xs text-slate-400">Preencha o Local A e o Local B</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
          {/* Endereço 1 (Local A) */}
          <div className="space-y-2 relative">
            <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-500" /> Local A (Endereço 1)
            </label>
            
            <div className="relative flex items-center">
              <input
                type="text"
                value={query1}
                onChange={(e) => {
                  setQuery1(e.target.value);
                  if (e.target.value.length > 2) handleSearchLoc1(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchLoc1(query1);
                  }
                }}
                placeholder="Ex: Av. Paulista, São Paulo"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-3.5 pr-20 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {query1 && (
                  <button
                    type="button"
                    onClick={clearLoc1}
                    className="p-1.5 text-slate-500 hover:text-slate-300 rounded-md"
                    title="Limpar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleGeolocate(1)}
                  disabled={geoLoading1}
                  className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-slate-800 rounded-md transition-colors"
                  title="Minha localização"
                >
                  {geoLoading1 ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> : <Navigation className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Suggestions 1 Dropdown */}
            {suggestions1.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50">
                <ul className="max-h-56 overflow-y-auto divide-y divide-slate-800/60 text-xs">
                  {suggestions1.map((item, idx) => (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() => handleSelectLoc1(item)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-800/80 flex items-start gap-2.5 transition-colors text-slate-200"
                      >
                        <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{item.formattedAddress}</p>
                          <p className="text-slate-400 text-[11px] mt-0.5">{item.city} {item.state ? `- ${item.state}` : ""}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {loc1.lat !== null && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Local A Selecionado
              </div>
            )}
          </div>

          {/* VS Divider Badge */}
          <div className="flex md:flex-col items-center justify-center self-center py-2 md:py-6">
            <div className="w-9 h-9 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-amber-400 font-extrabold text-xs shadow-lg">
              VS
            </div>
          </div>

          {/* Endereço 2 (Local B) */}
          <div className="space-y-2 relative">
            <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-500" /> Local B (Endereço 2)
            </label>

            <div className="relative flex items-center">
              <input
                type="text"
                value={query2}
                onChange={(e) => {
                  setQuery2(e.target.value);
                  if (e.target.value.length > 2) handleSearchLoc2(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchLoc2(query2);
                  }
                }}
                placeholder="Ex: Copacabana, Rio de Janeiro"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-3.5 pr-20 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {query2 && (
                  <button
                    type="button"
                    onClick={clearLoc2}
                    className="p-1.5 text-slate-500 hover:text-slate-300 rounded-md"
                    title="Limpar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleGeolocate(2)}
                  disabled={geoLoading2}
                  className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-slate-800 rounded-md transition-colors"
                  title="Minha localização"
                >
                  {geoLoading2 ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> : <Navigation className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Suggestions 2 Dropdown */}
            {suggestions2.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50">
                <ul className="max-h-56 overflow-y-auto divide-y divide-slate-800/60 text-xs">
                  {suggestions2.map((item, idx) => (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() => handleSelectLoc2(item)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-800/80 flex items-start gap-2.5 transition-colors text-slate-200"
                      >
                        <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{item.formattedAddress}</p>
                          <p className="text-slate-400 text-[11px] mt-0.5">{item.city} {item.state ? `- ${item.state}` : ""}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {loc2.lat !== null && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Local B Selecionado
              </div>
            )}
          </div>
        </div>

        {/* Popular Presets */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Exemplos Práticos de Comparação:
          </div>
          <div className="flex flex-wrap gap-2">
            {POPULAR_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(preset)}
                className="text-xs bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading state during comparison */}
      {analyzing && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-200">Cruzando microdados de ambos os locais...</p>
        </div>
      )}

      {/* Fetch Error */}
      {fetchError && (
        <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-xl flex items-center gap-3 text-red-300">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
          <p className="text-sm">{fetchError}</p>
        </div>
      )}

      {/* Unselected Prompt */}
      {(!loc1.lat || !loc2.lat) && !analyzing && (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 text-center space-y-3 text-slate-400">
          <GitCompare className="w-10 h-10 text-amber-500/60 mx-auto" />
          <h3 className="text-slate-200 font-bold text-base">Pronto para comparar!</h3>
          <p className="text-xs md:text-sm max-w-md mx-auto text-slate-400">
            Digite o <strong>Local A</strong> e o <strong>Local B</strong> nos campos acima para gerar o relatório estatístico comparativo em tempo real.
          </p>
        </div>
      )}

      {/* Results Section */}
      {data1 && data2 && !analyzing && (
        <div className="space-y-8">
          {!isComparable && (
            <div className="bg-amber-950/30 border border-amber-900/50 p-4 rounded-xl flex gap-3 text-amber-300 text-xs md:text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
              <p>
                <strong>Observação de Metodologia:</strong> As regiões possuem níveis de granularidade ou fontes estatísticas com preenchimentos distintos (Ex: Raio exato vs. Agregação municipal). Leve o contexto espacial em consideração.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RegionCard data={data1} address={loc1.address || "Local A"} label="Local A" />
            <RegionCard data={data2} address={loc2.address || "Local B"} label="Local B" />
          </div>

          {/* Analytical Conclusion */}
          {data1.score?.value !== undefined && data2.score?.value !== undefined && (
            <div className="bg-slate-900/80 border border-slate-800 p-6 md:p-8 rounded-3xl space-y-3 shadow-xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" /> Conclusão Analítica da Comparação
              </h3>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                A diferença entre os índices de segurança (Safety Score) é de{' '}
                <strong className="text-white">{Math.abs(data1.score.value - data2.score.value)} pontos</strong>.
                {data1.score.value > data2.score.value ? (
                  <>
                    {' '}
                    <span className="text-emerald-400 font-bold">{loc1.address || "Local A"}</span> apresenta estatísticas mais favoráveis no período analisado, com score{' '}
                    <strong className="text-emerald-400">{data1.score.value}/100</strong> contra{' '}
                    <strong className="text-amber-400">{data2.score.value}/100</strong> de{' '}
                    <span className="text-slate-300">{loc2.address || "Local B"}</span>.
                  </>
                ) : data2.score.value > data1.score.value ? (
                  <>
                    {' '}
                    <span className="text-emerald-400 font-bold">{loc2.address || "Local B"}</span> apresenta estatísticas mais favoráveis no período analisado, com score{' '}
                    <strong className="text-emerald-400">{data2.score.value}/100</strong> contra{' '}
                    <strong className="text-amber-400">{data1.score.value}/100</strong> de{' '}
                    <span className="text-slate-300">{loc1.address || "Local A"}</span>.
                  </>
                ) : (
                  <> Ambas as regiões apresentaram a mesma pontuação de segurança ({data1.score.value}/100).</>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RegionCard({ data, address, label }: { data: any; address: string; label: string }) {
  const isInsufficient = data.score?.classification === "Dados insuficientes";
  let scoreColor = "text-emerald-400";
  let badgeBg = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

  if (isInsufficient) {
    scoreColor = "text-slate-500";
    badgeBg = "bg-slate-800 text-slate-400 border-slate-700";
  } else if (data.score?.value < 40) {
    scoreColor = "text-red-400";
    badgeBg = "bg-red-500/10 text-red-400 border-red-500/20";
  } else if (data.score?.value < 75) {
    scoreColor = "text-amber-500";
    badgeBg = "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl relative overflow-hidden">
      <div className="border-b border-slate-800/80 pb-4 space-y-1">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-500">{label}</span>
        <h2 className="text-base font-bold text-white line-clamp-2 flex items-start gap-2">
          <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-1" />
          {address}
        </h2>
      </div>

      <div className="flex justify-between items-end">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">Safety Score</div>
          <div className={cn("text-5xl font-extrabold tracking-tight", scoreColor)}>
            {isInsufficient ? "-" : data.score?.value}
          </div>
          <div className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border mt-2", badgeBg)}>
            {data.score?.classification || "Não Classificado"}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">Confiança</div>
          <div className="text-2xl font-extrabold text-white">
            {(data.result?.confidence ? data.result.confidence * 100 : 0).toFixed(0)}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1 uppercase font-medium">
            {data.result?.granularity === 'coordinate' ? 'Exato (GPS)' : 'Municipal'}
          </div>
        </div>
      </div>

      {!isInsufficient && data.statistics && (
        <div className="space-y-3 pt-4 border-t border-slate-800/80 text-xs md:text-sm">
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Total Analisado (12M):</span>
            <span className="text-white font-bold">{data.statistics.total ?? 0}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Furtos:</span>
            <span className="text-amber-400 font-semibold">{data.statistics.breakdown?.thefts ?? 0}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Roubos:</span>
            <span className="text-red-400 font-semibold">{data.statistics.breakdown?.robberies ?? 0}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Ocorrências c/ Veículos:</span>
            <span className="text-blue-400 font-semibold">{data.statistics.breakdown?.vehicles ?? 0}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Homicídios (CVLI):</span>
            <span className="text-rose-400 font-semibold">{data.statistics.breakdown?.homicides ?? 0}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Compare;
