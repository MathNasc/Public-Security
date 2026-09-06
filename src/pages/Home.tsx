import { SearchBar } from "../components/SearchBar";
import { ShieldCheck, Map, BarChart3 } from "lucide-react";
import * as motion from "motion/react-client";

export function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4 py-12 relative overflow-hidden">
      <div className='absolute inset-0 opacity-10 pointer-events-none' style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)", backgroundSize: "40px 40px" }}></div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl text-center space-y-6 relative z-10"
      >
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
          Decisões mais seguras para <br/><span className="text-amber-500">o seu dia a dia.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 max-w-xl mx-auto">
          Consulte o histórico de segurança de qualquer rua ou bairro antes de ir a um evento, estacionar o carro ou se mudar.
        </p>

        <div className="pt-8 pb-12 w-full">
          <SearchBar />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left pt-12 border-t border-slate-800/50">
          <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-3 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700/50">
              <Map className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="font-semibold text-slate-200">1. Busque o local</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Pesquise qualquer rua, CEP ou bairro que você pretende visitar ou avaliar.
            </p>
          </div>
          
          <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-3 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700/50">
              <BarChart3 className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="font-semibold text-slate-200">2. Análise em tempo real</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Cruzamos instantaneamente o histórico criminal e dados de segurança no raio escolhido.
            </p>
          </div>
          
          <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-3 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700/50">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="font-semibold text-slate-200">3. Decisões seguras</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Visualize um score de risco claro e entenda se a região é segura para o seu objetivo.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
