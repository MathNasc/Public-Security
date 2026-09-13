import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Navigation, Loader2, AlertCircle, X } from "lucide-react";
import { cn } from '../lib/utils.js';

export function SearchBar({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setGeoError(null);
    try {
      const res = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSuggestions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLocateMe = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Geolocalização não suportada pelo navegador. Digite seu endereço na busca.");
      return;
    }
    
    setGeoLoading(true);
    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          let targetUrl = `/resultado?lat=${latitude}&lon=${longitude}&address=Localização%20Atual`;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, {
              headers: { 'User-Agent': 'PublicSecurity/1.0' }
            });
            const data = await res.json();
            const addressName = data.display_name || 'Localização Atual';
            targetUrl = `/resultado?lat=${latitude}&lon=${longitude}&address=${encodeURIComponent(addressName)}`;
          } catch {
            // fallback url used
          } finally {
            navigate(targetUrl);
            setGeoLoading(false);
          }
        },
        (error) => {
          setGeoLoading(false);
          if (error.code === 1 || error.message?.includes("permissions policy") || error.message?.includes("denied")) {
            setGeoError("Geolocalização desabilitada pela política de permissão do navegador/iframe. Digite seu endereço ou CEP na busca.");
          } else if (error.code === 2) {
            setGeoError("Sinal de GPS/localização indisponível. Digite seu endereço na busca.");
          } else if (error.code === 3) {
            setGeoError("Tempo limite para obter localização esgotado. Tente pesquisar pelo nome do local.");
          } else {
            setGeoError("Não foi possível obter localização automática. Digite seu endereço na busca.");
          }
        },
        { enableHighAccuracy: false, timeout: 8000 }
      );
    } catch {
      setGeoLoading(false);
      setGeoError("Geolocalização indisponível no ambiente. Digite seu endereço ou CEP na busca.");
    }
  };

  const handleSelect = (item: any) => {
    const targetUrl = `/resultado?lat=${item.latitude}&lon=${item.longitude}&address=${encodeURIComponent(item.formattedAddress)}`;
    navigate(targetUrl);
  };

  return (
    <div className={cn("relative w-full", className)}>
      <form onSubmit={handleSearch} className="relative flex items-center">
        <Search className="absolute left-4 w-5 h-5 text-slate-400" />
        <input
          type="text"
          aria-label="Digite um endereço"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (geoError) setGeoError(null);
          }}
          placeholder="Digite um endereço, CEP ou local"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl py-4 pl-12 pr-[180px] sm:pr-[200px] text-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-slate-100 placeholder:text-slate-500"
        />
        <div className="absolute right-2 flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={geoLoading}
            title="Usar minha localização atual"
            className="p-2.5 text-slate-400 hover:text-amber-500 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {geoLoading ? <Loader2 className="w-5 h-5 animate-spin text-amber-500" /> : <Navigation className="w-5 h-5" />}
          </button>
          <button
            type="submit"
            disabled={loading || !query}
            className="bg-slate-700 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg font-medium hover:bg-slate-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "Buscando..." : "Analisar"}
          </button>
        </div>
      </form>

      {geoError && (
        <div className="mt-2.5 bg-amber-950/40 border border-amber-800/60 rounded-lg p-2.5 px-3 flex items-start justify-between gap-2 text-xs text-amber-300">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <span>{geoError}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setGeoError(null)} 
            className="text-amber-400/70 hover:text-amber-300 p-0.5"
            aria-label="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden z-50">
          <ul className="max-h-80 overflow-y-auto divide-y divide-slate-700/50">
            {(suggestions || []).map((item, idx) => (
              <li key={idx}>
                <button
                  onClick={() => handleSelect(item)}
                  className="w-full text-left px-5 py-4 hover:bg-slate-700/50 flex items-start gap-3 transition-colors"
                >
                  <MapPin className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-slate-200 font-medium line-clamp-1">{item.formattedAddress}</p>
                    <p className="text-slate-400 text-sm mt-0.5">
                      {item.city} {item.state ? `- ${item.state}` : ""}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
