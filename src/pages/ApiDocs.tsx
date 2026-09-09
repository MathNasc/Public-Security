import React from 'react';
import { Database, Key, CheckCircle, Code, Shield } from 'lucide-react';

export function ApiDocs() {
  return (
    <div className="px-4 py-8 sm:py-12 max-w-5xl mx-auto space-y-6 sm:space-y-8">
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-8">
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center shrink-0">
          <Database className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">API de Dados Abertos (V1)</h1>
          <p className="text-slate-400 mt-2 text-sm sm:text-base leading-relaxed">
            Documentação oficial para integração pública e consumo dos dados agregados.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-8 shadow-xl">
        <h3 className="text-base sm:text-lg font-semibold text-slate-200 mb-2">Autenticação (X-API-Key)</h3>
        <p className="text-sm text-slate-400 mb-5 leading-relaxed">
          Para acessar os endpoints, inclua sua chave no header <code className="text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded ml-1">X-API-Key</code>.
        </p>
        
        <div className="bg-slate-950 p-4 rounded-xl font-mono text-xs sm:text-sm border border-slate-800/50 flex flex-col gap-2 overflow-x-auto">
          <div className="text-slate-500"># Exemplo de requisição</div>
          <div className="text-blue-400 whitespace-nowrap">curl <span className="text-slate-300">-X GET https://publicsecurity.app/api/public/v1/indicators?state=SP</span></div>
          <div className="text-blue-400 whitespace-nowrap"><span className="text-slate-300">  -H </span>"X-API-Key: sua_chave_aqui"</div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg sm:text-xl font-bold text-slate-200 px-1">Endpoints Disponíveis</h3>
        
        <div className="space-y-6">
        
        {/* Endpoint 1: Indicators */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <span className="bg-emerald-500/10 text-emerald-500 font-bold px-3 py-1 rounded text-xs self-start sm:self-auto shrink-0">GET</span>
            <code className="text-slate-200 font-mono text-xs sm:text-sm break-all">/api/public/v1/indicators</code>
          </div>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Retorna os indicadores de segurança agrupados por período e categoria de crime.
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Parâmetros de Query</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/50 pb-3 gap-1">
                  <code className="text-amber-500 font-mono">startDate</code> 
                  <span className="text-slate-400 text-xs sm:text-sm">Filtro de data inicial (YYYY-MM-DD)</span>
                </li>
                <li className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/50 pb-3 gap-1">
                  <code className="text-amber-500 font-mono">endDate</code> 
                  <span className="text-slate-400 text-xs sm:text-sm">Filtro de data final (YYYY-MM-DD)</span>
                </li>
                <li className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/50 pb-3 gap-1">
                  <code className="text-amber-500 font-mono">state</code> 
                  <span className="text-slate-400 text-xs sm:text-sm">UF do Estado (Ex: SP, RJ)</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Respostas Possíveis</h4>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /> 
                  <div>
                    <span className="text-slate-200 font-medium block">200 OK</span>
                    <span className="text-slate-400 text-xs">Array de indicadores estatísticos</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Endpoint 2: Occurrences */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <span className="bg-emerald-500/10 text-emerald-500 font-bold px-3 py-1 rounded text-xs self-start sm:self-auto shrink-0">GET</span>
            <code className="text-slate-200 font-mono text-xs sm:text-sm break-all">/api/public/v1/occurrences</code>
          </div>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Busca listagem de ocorrências criminais anonimizadas. Suporta paginação e filtros geográficos por aproximação (raio).
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Parâmetros de Query</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/50 pb-3 gap-1">
                  <code className="text-amber-500 font-mono">lat / lon</code> 
                  <span className="text-slate-400 text-xs sm:text-sm">Coordenadas centrais da busca</span>
                </li>
                <li className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/50 pb-3 gap-1">
                  <code className="text-amber-500 font-mono">radius</code> 
                  <span className="text-slate-400 text-xs sm:text-sm">Raio em metros (Requer lat/lon)</span>
                </li>
                <li className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/50 pb-3 gap-1">
                  <code className="text-amber-500 font-mono">state / city</code> 
                  <span className="text-slate-400 text-xs sm:text-sm">Filtros geográficos textuais</span>
                </li>
                <li className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/50 pb-3 gap-1">
                  <code className="text-amber-500 font-mono">limit / offset</code> 
                  <span className="text-slate-400 text-xs sm:text-sm">Paginação (Máximo: 100)</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Respostas Possíveis</h4>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /> 
                  <div>
                    <span className="text-slate-200 font-medium block">200 OK</span>
                    <span className="text-slate-400 text-xs">Lista paginada de ocorrências</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /> 
                  <div>
                    <span className="text-slate-200 font-medium block">400 Bad Request</span>
                    <span className="text-slate-400 text-xs">Parâmetros geográficos inválidos</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

      </div>
      </div>
      
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h4 className="text-base font-bold text-red-400 mb-1">Limites de Uso (Rate Limit)</h4>
          <p className="text-red-300/80 text-sm leading-relaxed">
            O acesso à API Pública é estritamente limitado a <strong className="text-red-300">100 requisições a cada 15 minutos por IP</strong> para garantir a estabilidade do banco de dados e evitar scrapings em massa.
          </p>
        </div>
      </div>
      
    </div>
  );
}
