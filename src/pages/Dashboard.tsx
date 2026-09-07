import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Shield, Map, Activity, BarChart2 } from "lucide-react";

export function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/summary")
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-12 flex justify-center items-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data || data.error || data.total === undefined || data.total === 0) {
    return (
      <div className="px-4 py-12 max-w-5xl mx-auto">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
          <Shield className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-200 mb-2">Sem Dados Nacionais</h2>
          <p className="text-slate-400 max-w-md mx-auto">Não há indicadores criminais agregados no banco de dados. Vá ao painel de Admin e execute a importação do SINESP.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto space-y-6 relative">
      <div className='absolute inset-0 opacity-10 pointer-events-none' style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)", backgroundSize: "40px 40px" }}></div>
      
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart2 className="w-8 h-8 text-amber-500" />
            Dashboard Nacional (SINESP)
          </h1>
          <p className="text-slate-400 mt-1">Visão macroscópica de indicadores criminais agregados.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <Shield className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-sm uppercase tracking-wider">Total Registros</h3>
          </div>
          <p className="text-4xl font-bold text-slate-100">{data.total.toLocaleString('pt-BR')}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <Activity className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-sm uppercase tracking-wider">Principal Crime</h3>
          </div>
          <p className="text-xl font-bold text-slate-100 truncate">{data.byCategory[0]?.name || "-"}</p>
          <p className="text-sm text-slate-500 mt-1">{data.byCategory[0]?.value.toLocaleString('pt-BR')} ocorrências</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <Map className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-sm uppercase tracking-wider">Estado Mais Afetado</h3>
          </div>
          <p className="text-xl font-bold text-slate-100">UF: {data.byState[0]?.name || "-"}</p>
          <p className="text-sm text-slate-500 mt-1">{data.byState[0]?.value.toLocaleString('pt-BR')} ocorrências</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10 pt-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="font-semibold text-lg text-white mb-6">Volume por Categoria</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byCategory} layout="vertical" margin={{ left: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f1f5f9' }}
                  itemStyle={{ color: '#fbbf24' }}
                />
                <Bar dataKey="value" fill="#fbbf24" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="font-semibold text-lg text-white mb-6">Tendência Temporal</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f1f5f9' }}
                  itemStyle={{ color: '#60a5fa' }}
                />
                <Line type="monotone" dataKey="value" stroke="#60a5fa" strokeWidth={3} dot={{ r: 4, fill: '#0f172a', stroke: '#60a5fa', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 lg:col-span-2">
          <h3 className="font-semibold text-lg text-white mb-6">Distribuição por Estado (Top 10)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byState.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f1f5f9' }}
                  itemStyle={{ color: '#10b981' }}
                  cursor={{ fill: '#1e293b' }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
