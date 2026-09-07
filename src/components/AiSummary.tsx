import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

export function AiSummary({ data }: { data: any }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!data || !data.result) return;
    
    // Check if we need to fetch
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data })
        });
        if (res.ok) {
          const json = await res.json();
          setSummary(json.summary);
        }
      } catch (e) {
        console.error("Summary error", e);
      }
      setLoading(false);
    };

    fetchSummary();
  }, [data]);

  if (!data) return null;

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[50px] rounded-full pointer-events-none" />
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500" /> O que mudou?
      </h3>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Gerando explicação baseada nos indicadores...
        </div>
      ) : summary ? (
        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {summary}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Não foi possível carregar o resumo estruturado.</p>
      )}
    </div>
  );
}
