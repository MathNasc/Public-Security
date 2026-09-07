import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ShieldCheck, ShieldAlert, Shield, AlertTriangle, MapPin, Activity, Check, X } from "lucide-react";
import * as motion from "motion/react-client";
import { cn } from "../lib/utils";

export function Compare() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const lat1 = searchParams.get("lat1");
  const lon1 = searchParams.get("lon1");
  const address1 = searchParams.get("address1") || "Região A";
  
  const lat2 = searchParams.get("lat2");
  const lon2 = searchParams.get("lon2");
  const address2 = searchParams.get("address2") || "Região B";

  const [data1, setData1] = useState<any>(null);
  const [data2, setData2] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      setError(true);
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`/api/analysis?lat=${lat1}&lon=${lon1}&radius=1000&period=12m`).then(r => r.json()),
      fetch(`/api/analysis?lat=${lat2}&lon=${lon2}&radius=1000&period=12m`).then(r => r.json())
    ]).then(([res1, res2]) => {
      setData1(res1);
      setData2(res2);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      setError(true);
      setLoading(false);
    });
  }, [lat1, lon1, lat2, lon2]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 mt-4">Processando comparação regional...</p>
      </div>
    );
  }

  if (error || !data1 || !data2 || data1.error || data2.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        Não foi possível realizar a comparação.
      </div>
    );
  }

  const isComparable = data1.result?.granularity === data2.result?.granularity && data1.result?.methodology === data2.result?.methodology;

  return (
    <div className="px-4 py-12 max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-2 mb-12">
        <h1 className="text-3xl font-bold text-white">Comparação de Regiões</h1>
        <p className="text-slate-400">Analisando histórico de criminalidade para as duas localidades selecionadas.</p>
      </div>

      {!isComparable && (
        <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-xl flex gap-3 text-red-300">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <p className="text-sm">
            <strong>Atenção: Não é possível realizar uma comparação estatística perfeitamente confiável.</strong> As regiões possuem níveis de granularidade ou metodologias diferentes (Ex: Uma utiliza Raio Exato e outra utiliza Taxa Municipal). Compare com cautela.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <RegionCard data={data1} address={address1} />
        <RegionCard data={data2} address={address2} />
      </div>

      {isComparable && data1.score.classification !== "Dados insuficientes" && data2.score.classification !== "Dados insuficientes" && (
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
           <h3 className="text-lg font-semibold text-white mb-4">Conclusão Analítica</h3>
           <p className="text-slate-400">
             A diferença entre os Scores é de {Math.abs(data1.score.value - data2.score.value)} pontos. 
             {data1.score.value > data2.score.value ? ` ${address1} apresenta indicadores matematicamente mais favoráveis com Confiança ${(data1.result?.confidence * 100).toFixed(0)}%.` : ` ${address2} apresenta indicadores matematicamente mais favoráveis com Confiança ${(data2.result?.confidence * 100).toFixed(0)}%.`}
           </p>
        </div>
      )}
    </div>
  );
}

function RegionCard({ data, address }: { data: any, address: string }) {
  const isInsufficient = data.score.classification === "Dados insuficientes";
  let scoreColor = "text-green-400";
  if (isInsufficient) scoreColor = "text-slate-500";
  else if (data.score.value < 40) scoreColor = "text-red-400";
  else if (data.score.value < 75) scoreColor = "text-amber-500";

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-lg font-bold text-white line-clamp-1 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-amber-500" /> {address}
        </h2>
      </div>

      <div className="flex justify-between items-end">
        <div>
           <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">Safety Score</div>
           <div className={cn("text-5xl font-bold", scoreColor)}>{isInsufficient ? "-" : data.score.value}</div>
           <div className={cn("font-medium mt-2", scoreColor)}>{data.score.classification}</div>
        </div>
        <div className="text-right">
           <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">Confiança</div>
           <div className="text-2xl font-bold text-white">{(data.result?.confidence ? data.result.confidence * 100 : 0).toFixed(0)}%</div>
           <div className="text-xs text-slate-400 mt-2 uppercase">{data.result?.granularity === 'coordinate' ? 'Exato' : 'Municipal'}</div>
        </div>
      </div>

      {!isInsufficient && (
        <div className="space-y-4 pt-4 border-t border-slate-800/50">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Total Analisado</span>
            <span className="text-white font-bold">{data.statistics.total}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Furtos</span>
            <span className="text-amber-400 font-bold">{data.statistics.breakdown.thefts}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Roubos</span>
            <span className="text-red-400 font-bold">{data.statistics.breakdown.robberies}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Veículos</span>
            <span className="text-blue-400 font-bold">{data.statistics.breakdown.vehicles}</span>
          </div>
        </div>
      )}
    </div>
  );
}
