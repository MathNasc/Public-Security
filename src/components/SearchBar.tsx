import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Navigation, Loader2 } from "lucide-react";
import { cn } from '../lib/utils.js';

export function SearchBar({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
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
    if (!navigator.geolocation) {
      alert("Geolocalização não suportada pelo seu navegador.");
      return;
    }
    
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Reverse geocoding option (optional)
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, {
            headers: { 'User-Agent': 'PublicSecurity/1.0' }
          });
          const data = await res.json();
          const addressName = data.display_name || 'Localização Atual';
          navigate(`/resultado?lat=${latitude}&lon=${longitude}&address=${encodeURIComponent(addressName)}`);
        } catch (err) {
          navigate(`/resultado?lat=${latitude}&lon=${longitude}&address=Localização%20Atual`);
        } finally {
          setGeoLoading(false);
        }
      },
      (error) => {
        setGeoLoading(false);
        console.error("Erro ao obter localização:", error.message || error);
        if(error.message&&error.message.includes("permissions policy")){alert("Dica: Para usar a localização dentro do editor, clique no ícone 'Abrir em nova guia' ↗ no topo do preview, ou acesse pelo link da Vercel!");}else{alert("Não foi possível acessar sua localização. Certifique-se de que o navegador tem permissão e recarregue a página.");}
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSelect = (item: any) => {
    navigate(`/resultado?lat=${item.latitude}&lon=${item.longitude}&address=${encodeURIComponent(item.formattedAddress)}`);
  };

  return (
    <div className={cn("relative w-full", className)}>
      <form onSubmit={handleSearch} className="relative flex items-center">
        <Search className="absolute left-4 w-5 h-5 text-slate-400" />
        <input
          type="text"
          aria-label="Digite um endereço"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
