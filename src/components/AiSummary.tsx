import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cleanAiText } from '../lib/formatAiText.js';

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

  const cleanedText = cleanAiText(summary);

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
      ) : cleanedText ? (
        <div className="text-sm text-slate-300 leading-relaxed space-y-2 markdown-body">
          <ReactMarkdown
            components={{
              h3: ({ children }) => <h3 className="text-base font-bold text-amber-400 mt-3 mb-1.5">{children}</h3>,
              h4: ({ children }) => <h4 className="text-sm font-bold text-slate-200 mt-2 mb-1">{children}</h4>,
              p: ({ children }) => <p className="mb-2 text-slate-300 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 text-slate-300">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-3 text-slate-300">{children}</ol>,
              li: ({ children }) => <li className="leading-snug">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
              hr: () => null,
            }}
          >
            {cleanedText}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Não foi possível carregar o resumo estruturado.</p>
      )}
    </div>
  );
}

