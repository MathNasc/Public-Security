import React from 'react';
import { Database, CheckCircle, Code, Shield, AlertTriangle, MapPin, Activity, HelpCircle, Lock } from 'lucide-react';

export function ApiDocs() {
  return (
    <div className="px-4 py-8 sm:py-12 max-w-5xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-8">
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center shrink-0 border border-amber-500/20">
          <Database className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">API Pública de Segurança Pública (v1)</h1>
          <p className="text-slate-400 mt-1.5 text-sm sm:text-base leading-relaxed max-w-2xl">
            Documentação técnica oficial para integração externa. Fornece geocodificação, identificação territorial, análise gravimétrica de risco e indicadores oficiais de segurança.
          </p>
        </div>
      </div>

      {/* Diretrizes de Integridade dos Dados */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-base sm:text-lg font-semibold text-slate-200 flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-500" /> Diretrizes de Integridade e Regras da API
        </h3>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          A API do Public Security opera sob princípios estritos de transparência estatística e conformidade jurídica:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Nunca inventa dados:</strong> Toda resposta é derivada exclusivamente de registros públicos oficiais (SSP e SINESP).</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Ausência não é zero:</strong> Regiões sem dados retornam <code className="text-amber-400 font-mono">score: null</code> e status <code className="text-amber-400 font-mono">"insufficient_data"</code>, jamais score zero.</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Transparência em Fallbacks:</strong> Sempre declara se utilizou agregação municipal ou estadual caso microdados pontuais não existam.</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Confiança ≠ Segurança:</strong> O índice de confiança mede cobertura, recência e completude amostral, e não a segurança física do local.</span>
          </div>
        </div>
      </div>

      {/* Autenticação */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <h3 className="text-base sm:text-lg font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-500" /> Autenticação (Header X-API-Key)
        </h3>
        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
          Para acessar os endpoints da API pública, inclua sua chave no cabeçalho HTTP <code className="text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono text-xs">X-API-Key</code>.
        </p>
        
        <div className="bg-slate-950 p-4 rounded-xl font-mono text-xs sm:text-sm border border-slate-800/50 flex flex-col gap-2 overflow-x-auto text-slate-300">
          <div className="text-slate-500"># Exemplo de requisição com curl</div>
          <div className="text-amber-400 whitespace-nowrap">curl -X GET "https://publicsecurity.app/api/public/v1/analysis?lat=-23.56168&lon=-46.65598&radius=1000&period=12m" \</div>
          <div className="text-slate-300 pl-4 whitespace-nowrap">-H "X-API-Key: test_api_key_123"</div>
        </div>
      </div>

      {/* Endpoints */}
      <div className="space-y-6">
        <h3 className="text-lg sm:text-xl font-bold text-slate-200 px-1">Endpoints Públicos Disponíveis</h3>
        
        {/* Endpoint 1: Analysis (Fluxo Principal) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm overflow-hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold px-2.5 py-1 rounded text-xs self-start shrink-0 font-mono">GET</span>
            <code className="text-slate-100 font-mono text-xs sm:text-sm break-all font-semibold">/api/public/v1/analysis</code>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            <strong>Fluxo Completo de Segurança Pública:</strong> Executa a identificação territorial por coordenadas (PostGIS/Centróide), consulta de ocorrências oficiais, agregação gravimétrica de indicadores, cálculo do Safety Score, nível de confiança, histórico, fatores de influência e explicitação de fallbacks.
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Parâmetros de Query</h4>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <code className="text-amber-400 font-mono">lat</code>
                  <span className="text-slate-400">Obrigatório. Latitude em graus decimais (-90 a 90)</span>
                </li>
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <code className="text-amber-400 font-mono">lon</code>
                  <span className="text-slate-400">Obrigatório. Longitude em graus decimais (-180 a 180)</span>
                </li>
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <code className="text-amber-400 font-mono">radius</code>
                  <span className="text-slate-400">Opcional. Raio em metros (padrão: 1000, máx: 50000)</span>
                </li>
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <code className="text-amber-400 font-mono">period</code>
                  <span className="text-slate-400">Opcional. Período: 1w, 1m, 3m, 6m, 12m, all ou YYYY</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Estrutura da Resposta</h4>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-48">
                <pre>{`{
  "score": 78, // ou null se dados insuficientes
  "status": "high_confidence",
  "confidence": 0.88,
  "confidenceExplanation": "...",
  "geographicIdentification": {
    "municipalityName": "São Paulo",
    "stateAcronym": "SP",
    "ibgeCode": "3550308"
  },
  "granularity": "coordinate", // ou "municipality"
  "fallback": { "used": false, "type": "none" },
  "factors": ["Ocorrência de roubos...", "Crimes violentos..."],
  "limitations": ["Subnotificação crônica..."],
  "indicators": [...]
}`}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* Endpoint 2: Geocode */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm overflow-hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold px-2.5 py-1 rounded text-xs self-start shrink-0 font-mono">GET</span>
            <code className="text-slate-100 font-mono text-xs sm:text-sm break-all font-semibold">/api/public/v1/geocode</code>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            Geocodificação unificada para o território nacional. Suporta busca por endereço textual, CEP brasileiro (com ou sem hífen) e coordenadas diretas.
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Parâmetros de Query</h4>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <code className="text-amber-400 font-mono">query</code>
                  <span className="text-slate-400">Obrigatório. Endereço, CEP (ex: 01310-100) ou Coordenadas (ex: -23.56, -46.65)</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Respostas Possíveis</h4>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>200 OK:</strong> Array de locais com latitude, longitude, cidade e UF</span>
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span><strong>400 Bad Request:</strong> Parâmetro query ausente ou vazio</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Endpoint 3: Indicators */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm overflow-hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold px-2.5 py-1 rounded text-xs self-start shrink-0 font-mono">GET</span>
            <code className="text-slate-100 font-mono text-xs sm:text-sm break-all font-semibold">/api/public/v1/indicators</code>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            Retorna séries históricas de indicadores de segurança pública consolidados por UF, categoria canônica ou período (mês/ano).
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Filtros Opcionais</h4>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <code className="text-amber-400 font-mono">uf</code>
                  <span className="text-slate-400">Sigla do Estado (ex: SP, RJ)</span>
                </li>
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <code className="text-amber-400 font-mono">category</code>
                  <span className="text-slate-400">Categoria (theft, robbery, violent_death, etc.)</span>
                </li>
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <code className="text-amber-400 font-mono">period</code>
                  <span className="text-slate-400">Período mensal (formato YYYY-MM)</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Formato de Saída</h4>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300">
                {`{
  "meta": { "count": 25 },
  "data": [
    { "category": "theft", "value": 1420, "period": "2024-05", "stateCode": "SP" }
  ]
}`}
              </div>
            </div>
          </div>
        </div>

        {/* Endpoint 4: Occurrences */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm overflow-hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold px-2.5 py-1 rounded text-xs self-start shrink-0 font-mono">GET</span>
            <code className="text-slate-100 font-mono text-xs sm:text-sm break-all font-semibold">/api/public/v1/occurrences</code>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            Busca pontual de ocorrências criminais anonimizadas por aproximação espacial geográfica (raio em metros ao redor de latitude/longitude).
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Parâmetros</h4>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <code className="text-amber-400 font-mono">lat, lon, radius</code>
                  <span className="text-slate-400">Filtro espacial obrigatório para busca por proximidade</span>
                </li>
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <code className="text-amber-400 font-mono">limit</code>
                  <span className="text-slate-400">Limite de registros (padrão: 50, máx: 500)</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Privacidade</h4>
              <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                Todos os microdados são anonimizados em conformidade com a LGPD e as resoluções de transparência pública, sem dados de identificação pessoal de vítimas ou testemunhas.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Rate Limit */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
          <Shield className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h4 className="text-base font-bold text-slate-200 mb-1">Política de Taxa de Requisições (Rate Limit)</h4>
          <p className="text-slate-400 text-sm leading-relaxed">
            O acesso à API Pública é limitado a <strong className="text-amber-400 font-semibold">100 requisições a cada 15 minutos por endereço IP</strong>. Requisições excedentes receberão resposta HTTP 429 (Too Many Requests).
          </p>
        </div>
      </div>
      
    </div>
  );
}
