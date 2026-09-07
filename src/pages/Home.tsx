import { SearchBar } from "../components/SearchBar";
import { ShieldCheck, Map, Activity } from "lucide-react";
import * as motion from "motion/react-client";

export function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4 py-12 relative overflow-hidden">
      <div className='absolute inset-0 opacity-10 pointer-events-none' style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #475569 1px, transparent 0)", backgroundSize: "40px 40px" }}></div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl text-center space-y-8 relative z-10"
      >
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
            Descubra o histórico de segurança <br/><span className="text-amber-500">da sua vizinhança.</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto">
            Consulte dados oficiais de criminalidade de qualquer rua ou cidade antes de ir a um evento, estacionar o carro ou se mudar.
          </p>
        </div>

        <div className="pt-4 pb-8 w-full">
          <SearchBar />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left pt-12 border-t border-slate-800/50">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-800">
              <Map className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="font-semibold text-slate-200">1. Onde você vai?</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Pesquise qualquer endereço, bairro ou município.
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-800">
              <Activity className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="font-semibold text-slate-200">2. Análise Imediata</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Cruzamos instantaneamente o histórico criminal público num raio de proximidade.
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-800">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="font-semibold text-slate-200">3. Transparência</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Descubra por que a região obteve a nota, o nível de confiança dos dados e o que mais acontece lá.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
