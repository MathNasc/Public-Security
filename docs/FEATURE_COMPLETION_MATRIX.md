# Matriz de Conclusão de Funcionalidades (Feature Completion Matrix)

Esta auditoria analisa com profundidade técnica todas as funcionalidades existentes na base de código do **Radar Criminal Brasil**, avaliando cada subsistema em 12 dimensões: Backend, Banco, Serviço, Frontend, Integração, Tratamento de Erros, Estados Vazios, Segurança, Testes, Documentação, Observabilidade e Funcionamento em Ambiente Limpo.

---

## 1. Tabela Geral de Conclusão

| Funcionalidade | Backend | Banco | Frontend | Integração | Testes | Docs | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Busca e Geocodificação** | COMPLETO | N/A | COMPLETO | COMPLETO | NÃO | COMPLETO | **COMPLETA** |
| **Mapa Interativo Geoespacial** | COMPLETO | COMPLETO | COMPLETO | COMPLETO | NÃO | COMPLETO | **COMPLETA** |
| **Análise Espacial de Segurança e Score** | COMPLETO | COMPLETO | COMPLETO | COMPLETO | NÃO | COMPLETO | **COMPLETA** |
| **Sumarização com IA (Gemini + Fallback)** | COMPLETO | N/A | COMPLETO | COMPLETO | NÃO | COMPLETO | **COMPLETA** |
| **Dashboard Nacional Macro (SINESP)** | COMPLETO | COMPLETO | COMPLETO | COMPLETO | NÃO | COMPLETO | **COMPLETA** |
| **Comparador Regional de Localidades** | COMPLETO | COMPLETO | COMPLETO | COMPLETO | NÃO | COMPLETO | **COMPLETA** |
| **Painel de Qualidade de Dados (Admin)** | COMPLETO | COMPLETO | COMPLETO | COMPLETO | NÃO | COMPLETO | **COMPLETA** |
| **Pipeline de Ingestão e Worker Autônomo** | COMPLETO | COMPLETO | COMPLETO | COMPLETO | NÃO | COMPLETO | **COMPLETA** |
| **Armazenamento RAW Imutável (Storage)** | COMPLETO | COMPLETO | N/A | COMPLETO | NÃO | COMPLETO | **COMPLETA** |
| **Taxonomia Canônica Nacional** | COMPLETO | N/A | COMPLETO | COMPLETO | NÃO | COMPLETO | **COMPLETA** |
| **Upload Manual de Planilhas (Admin)** | COMPLETO | COMPLETO | COMPLETO | COMPLETO | NÃO | COMPLETO | **COMPLETA** |
| **Verificador de Links Oficiais (AutoDownloader)** | COMPLETO | COMPLETO | COMPLETO | COMPLETO | NÃO | COMPLETO | **COMPLETA** |
| **Orquestrador de Jobs (Scheduler & Discovery)** | COMPLETO | COMPLETO | COMPLETO | COMPLETO | NÃO | COMPLETO | **COMPLETA** |
| **Seeding Geográfico e Municípios IBGE** | COMPLETO | COMPLETO | N/A | COMPLETO | NÃO | COMPLETO | **COMPLETA** |
| **Gráfico de Tendências Históricas** | PARCIAL | COMPLETO | COMPLETO | PARCIAL | NÃO | PARCIAL | **PARCIAL** |
| **API Pública Versionada (Open Data V1)** | PARCIAL | COMPLETO | COMPLETO | PARCIAL | NÃO | PARCIAL | **PARCIAL** |
| **Acompanhamento de Região e Alertas** | PARCIAL | PARCIAL | PARCIAL | INCOMPLETO | NÃO | INCOMPLETO | **INCOMPLETA** |
| **Validação dos 27 Adapters Estaduais** | COMPLETO | COMPLETO | COMPLETO | NÃO VALIDADA | NÃO | PARCIAL | **NÃO VALIDADA** |

---

## 2. Avaliação Detalhada por Funcionalidade (12 Dimensões)

### 2.1. Busca e Geocodificação
- **Backend:** Rota `/api/geocode` com `geocodeLimiter` (30 req/min). Suporta query textual e regex de CEP nacional.
- **Banco:** Não persiste consultas; utiliza cache LRU interno em memória para otimização.
- **Serviço:** `GeocodingService.ts` integrando ViaCEP para resolução de CEP e OpenStreetMap Nominatim para coordenadas geográficas.
- **Frontend:** Componente `SearchBar.tsx` com input acessível, dropdown de sugestões, debounce e feedback de carregamento.
- **Integração:** HTTP externo (ViaCEP + Nominatim) com cabeçalho de User-Agent customizado.
- **Tratamento de erros:** Trata falhas de rede no ViaCEP fazendo fallback transparente para busca direta no Nominatim.
- **Estados vazios:** Exibe mensagem explicativa quando nenhum endereço é encontrado.
- **Segurança:** Rate limit estrito contra abuso de scraping geográfico.
- **Testes:** Sem testes automatizados.
- **Documentação:** Mapeada nos fluxos de usuário e arquitetura ativa.
- **Observabilidade:** Logs estruturados via `logger.warn` e `logger.error`.
- **Ambiente limpo:** Opera perfeitamente em ambiente limpo sem dependência de dados pré-existentes no banco.
- **Classificação:** **COMPLETA**.

---

### 2.2. Análise Espacial de Segurança e Cálculo do Score Regional
- **Backend:** Rota `GET /api/analysis` com rate limit público e limite máximo de raio (50 km) contra DoS.
- **Banco:** PostgreSQL com PostGIS. Executa buscas espaciais otimizadas por bounding box (`&&`) e cálculo de distância métrica exata (`ST_Distance` / `haversineDistance`).
- **Serviço:** `SafetyAnalysisService.ts`. Agrega ocorrências e indicadores, calcula o Score de Segurança (0–100), calcula o índice de confiança estatística (0.0–1.0) e seleciona a metodologia adequada (Raio Exato vs. Taxa Municipal).
- **Frontend:** Tela `Result.tsx` exibindo pontuação, classificação visual por cor, nível de confiança com tooltip explicativo, quebra por categoria e filtros de período (3m, 6m, 12m, histórico).
- **Integração:** Drizzle ORM + PostGIS queries.
- **Tratamento de erros:** Validação de formato de coordenadas; captura de exceções de banco com fallback elegante para payload de "Dados insuficientes".
- **Estados vazios:** Quando não há registros num raio ou município, retorna status `'insufficient_data'`, score 0 e classificação informativa "Dados insuficientes".
- **Segurança:** Sanitização de entradas numéricas, capping de raio em 50.000m e cache em memória (`analysisCache`).
- **Testes:** Sem testes automatizados do algoritmo estatístico.
- **Documentação:** Documentado formalmente em `SAFETY_SCORE.md` e `METHODOLOGY.md`.
- **Observabilidade:** Logs de análise e métricas no console e logger.
- **Ambiente limpo:** Funciona perfeitamente; em banco vazio, apresenta o estado gracioso de dados insuficientes.
- **Classificação:** **COMPLETA**.

---

### 2.3. Mapa Interativo Geoespacial
- **Backend:** Provê pontos pontuais com coordenadas no retorno de `/api/analysis` (`exactOccurrences`).
- **Banco:** Coluna `geom` (geometria `Point`, SRID 4326) em `security_occurrences`.
- **Serviço:** `SafetyAnalysisService.ts`.
- **Frontend:** `Result.tsx` utilizando `react-leaflet`, camada base de tiles escuros, círculo translúcido delimitando o raio de análise, marcadores circulares (`CircleMarker`) com cores correspondentes à severidade do crime, popups detalhados com tipificação canônica e data, e componente de centralização dinâmica `MapUpdater`.
- **Integração:** React-Leaflet + OpenStreetMap CartoDB tiles.
- **Tratamento de erros:** Não renderiza marcadores com coordenadas inválidas/nulas; centraliza no ponto buscado mesmo sem ocorrências.
- **Estados vazios:** Exibe o ponto e o círculo de busca vazios com o mapa funcional.
- **Segurança:** Ocorrências anonimizadas sem nomes, RG, CPF ou endereços residenciais exatos.
- **Testes:** Sem testes visuais ou E2E.
- **Documentação:** Documentado em `PRODUCT_UX.md`.
- **Observabilidade:** Telemetria padrão do Leaflet no console.
- **Ambiente limpo:** Renderiza imediatamente em ambiente limpo.
- **Classificação:** **COMPLETA**.

---

### 2.4. Sumarização Inteligente (Gemini + Fallback Heurístico)
- **Backend:** Rota `POST /api/summary` com rate limiter.
- **Banco:** Não acessa o banco diretamente (consome o payload agregado pré-computado).
- **Serviço:** `SummaryService.ts`. Integração com `@google/genai` utilizando `gemini-3.6-flash`. Possui mecanismo de fallback heurístico/determinístico caso a chave `GEMINI_API_KEY` não esteja presente ou ocorra timeout na API externa.
- **Frontend:** Componente `AiSummary.tsx` em `Result.tsx` com animação de carregamento, ícones temáticos e apresentação do texto estruturado.
- **Integração:** SDK oficial Google Gen AI.
- **Tratamento de erros:** Try/catch resiliente: se o modelo falhar ou retornar erro, o fallback procedural assume sem estourar erro para o usuário.
- **Estados vazios:** Se não houver ocorrências no período, gera parágrafo conciso informando a ausência de registros policiais na área.
- **Segurança:** Chave de API mantida estritamente no backend (server-side only).
- **Testes:** Sem testes automatizados de integração com mock do Gemini.
- **Documentação:** Mapeado em `ACTIVE_ARCHITECTURE.md`.
- **Observabilidade:** Logs estruturados via `logger.info` e `logger.error`.
- **Ambiente limpo:** Funciona perfeitamente com ou sem chave de API.
- **Classificação:** **COMPLETA**.

---

### 2.5. Dashboard Nacional Macro (SINESP)
- **Backend:** Rota `GET /api/dashboard/summary` em `server.ts`.
- **Banco:** Consultas agregadas via SQL puro agrupando por categoria, código de estado e período em `security_indicators`.
- **Serviço:** Handlers SQL agregados em `server.ts`.
- **Frontend:** Página `Dashboard.tsx` com 3 cards superiores (Total Registros, Principal Crime, Estado Mais Afetado), gráfico de barras por categoria penal, ranking de estados afetados e evolução temporal com `Recharts`.
- **Integração:** Drizzle ORM SQL execute.
- **Tratamento de erros:** Try/catch capturando falhas de consulta e retornando erro 500 padronizado.
- **Estados vazios:** Se `total === 0`, renderiza tela alternativa com escudo e orientação de importação de dados no painel administrativo.
- **Segurança:** Agregações anônimas sem exposição de dados sensíveis.
- **Testes:** Sem testes automatizados.
- **Documentação:** Documentado em `data-sources.md`.
- **Observabilidade:** Log de erro via `logger.error`.
- **Ambiente limpo:** Apresenta estado vazio amigável e informativo.
- **Classificação:** **COMPLETA**.

---

### 2.6. Comparador Regional de Localidades
- **Backend:** Consome em paralelo o endpoint `/api/analysis` para duas coordenadas distintas.
- **Banco:** Consultas espaciais independentes em `security_occurrences` e `security_indicators`.
- **Serviço:** `SafetyAnalysisService.ts`.
- **Frontend:** Página `Compare.tsx` com dois cards lado a lado, validação de compatibilidade estatística (`isComparable`), alerta caso uma localidade use Raio Exato e a outra use Taxa Municipal, e conclusão textual automática com delta de pontuação e confiança.
- **Integração:** `Promise.all` no frontend chamando `/api/analysis`.
- **Tratamento de erros:** Mensagem de erro em caso de ausência de parâmetros na URL ou falha de requisição.
- **Estados vazios:** Trata graciosamente caso uma ou ambas as localidades não possuam dados históricos.
- **Segurança:** Protegido por rate limit da API de análise.
- **Testes:** Sem testes automatizados.
- **Documentação:** Documentado em `PRODUCT_UX.md`.
- **Observabilidade:** Logs no console do navegador.
- **Ambiente limpo:** Funciona perfeitamente.
- **Classificação:** **COMPLETA**.

---

### 2.7. Painel de Qualidade de Dados (Admin Data Quality)
- **Backend:** Rota `GET /api/admin/data-quality` protegida.
- **Banco:** Agregações em `security_occurrences` e leitura de histórico recente de lotes em `data_imports`.
- **Serviço:** Lógica de agregação de qualidade em `server.ts`.
- **Frontend:** Aba "Qualidade de Dados" em `Admin.tsx` com porcentagem de completude, contadores de coordenadas ausentes, data mínima e máxima, e tabela de lotes processados.
- **Integração:** Drizzle ORM sobre `security_occurrences` e `data_imports`.
- **Tratamento de erros:** Try/catch retornando estrutura zerada segura.
- **Estados vazios:** Exibe contadores em 0 sem quebras de renderização.
- **Segurança:** Protegido por senha administrativa via modal e header de autorização.
- **Testes:** Sem testes automatizados.
- **Documentação:** Documentado em `DATA_QUALITY.md`.
- **Observabilidade:** Logs de auditoria no console.
- **Ambiente limpo:** Funciona imediatamente exibindo zeros.
- **Classificação:** **COMPLETA**.

---

### 2.8. Pipeline de Ingestão e Worker Autônomo
- **Backend:** `Worker.ts` operando em loop assíncrono não bloqueante contínuo (5s).
- **Banco:** Leitura atômica de `data_imports` com `FOR UPDATE SKIP LOCKED`, gravação em lote de 2.000 itens em `security_occurrences` e `security_indicators`, atualização de métricas e status do job.
- **Serviço:** `IngestionWorker`, integrado com `RawStorage`, `Taxonomy`, `GeoNormalizationService` e `BaseAdapter`.
- **Frontend:** Monitorável na aba de automação em `Admin.tsx` (`/api/admin/ingestion/status`).
- **Integração:** Streaming CSV (`csv-parse`) lendo do disco local particionado.
- **Tratamento de erros:** Trata falhas de parsing por linha (incrementa `records_invalid`), salva `last_error` no job e finaliza com status `FAILED` em erro catastrófico.
- **Estados vazios:** Se não há jobs enfileirados, dorme sem consumir CPU ou memória.
- **Segurança:** Inserções com limites de lote e proteção contra overflow de buffer de memória.
- **Testes:** Sem testes automatizados de ponta a ponta com arquivos reais.
- **Documentação:** Documentado formalmente em `ACTIVE_ARCHITECTURE.md`.
- **Observabilidade:** Logs prefixados estruturados no stdout (`[Worker <id>] Job Completed`).
- **Ambiente limpo:** Inicia e opera de forma limpa.
- **Classificação:** **COMPLETA**.

---

### 2.9. Armazenamento RAW Imutável (Storage)
- **Backend:** Classe `RawStorage` em `src/ingestion/pipeline/Storage.ts`.
- **Banco:** Metadados gravados em `data_imports` (`rawFilePath`, `checksum`, `fileSize`, `originalFilename`).
- **Serviço:** Persiste streams no caminho particionado `raw_storage/{datasetId}/{version}/{filename}`, calculando hash SHA-256 e tamanho de arquivo durante a escrita do stream.
- **Frontend:** Sem UI direta (gerenciado internamente pelo pipeline).
- **Integração:** Streams do Node.js (`fs.createWriteStream`, `crypto.createHash`).
- **Tratamento de erros:** Propagação de erro de I/O de disco para o chamador.
- **Estados vazios:** Criação automática de diretórios recursivos se não existirem.
- **Segurança:** Arquivos fora da árvore pública do servidor web (inacessíveis via HTTP direto).
- **Testes:** Sem testes automatizados de I/O.
- **Documentação:** Documentado em `ACTIVE_ARCHITECTURE.md`.
- **Observabilidade:** Logs de caminho e hash nos jobs.
- **Ambiente limpo:** Diretório inicializado automaticamente sem erros.
- **Classificação:** **COMPLETA**.

---

### 2.10. Taxonomia Canônica Nacional
- **Backend:** `src/services/Taxonomy.ts`.
- **Banco:** Coluna canônica `category` nas tabelas `security_occurrences` e `security_indicators`.
- **Serviço:** Funções `normalizeLegacyCategory`, `getCategoryGroup`, constantes `TAXONOMY_VERSION`, `CANONICAL_CATEGORIES` e `CATEGORY_GROUPS`. Mapeia mais de 80 termos policiais para as 7 macro-categorias canônicas.
- **Frontend:** Mapeamento de rótulos em português amigável nas tabelas e gráficos (`categoryMap`).
- **Integração:** Utilizado transversalmente pelo Worker, Adapters e `SafetyAnalysisService`.
- **Tratamento de erros:** Fallback automático para `'other'` caso o termo de entrada não seja reconhecido.
- **Estados vazios:** Strings vazias ou nulas mapeadas com segurança para `'other'`.
- **Segurança:** Previne SQL injection ou chaves corrompidas por usar união estrita de tipos TypeScript.
- **Testes:** Sem testes unitários de cobertura para todas as variações léxicas.
- **Documentação:** Documentado em `METHODOLOGY.md` e `ACTIVE_ARCHITECTURE.md`.
- **Observabilidade:** N/A.
- **Ambiente limpo:** Totalmente independente de banco ou rede.
- **Classificação:** **COMPLETA**.

---

### 2.11. Upload Manual de Planilhas (Admin SSP Upload)
- **Backend:** Rota `POST /api/admin/upload-ssp` com middleware `multer` e autenticação `adminAuth`.
- **Banco:** Cria registro em `data_imports` via `JobManager.createJob`.
- **Serviço:** Direciona o stream de upload diretamente para `RawStorage.put()` e limpa o arquivo temporário do multer.
- **Frontend:** Seção de upload em `Admin.tsx` com input de arquivo e botão com feedback de envio.
- **Integração:** Multer + RawStorage + JobManager.
- **Tratamento de erros:** Remove o arquivo temporário em caso de falha e retorna código 500 com o motivo do erro.
- **Estados vazios:** Retorna 400 se nenhum arquivo for enviado no corpo do formulário.
- **Segurança:** Protegido por senha administrativa via Bearer token.
- **Testes:** Sem testes automatizados de upload multipart.
- **Documentação:** Documentado em `ACTIVE_ARCHITECTURE.md`.
- **Observabilidade:** `logger.error("SSP upload processing error")`.
- **Ambiente limpo:** Funciona perfeitamente.
- **Classificação:** **COMPLETA**.

---

### 2.12. Verificador de Links Oficiais (AutoDownloader)
- **Backend:** Rota `POST /api/admin/automation/trigger-all` em `server.ts`.
- **Banco:** Atualiza coluna `status` (`OPERATIONAL`, `OFFLINE`) na tabela `data_sources`.
- **Serviço:** `AutoDownloader.ts`. Executa checagem HTTP HEAD/GET com timeout curto (5s) em cada URL de portal oficial cadastrado.
- **Frontend:** Botão "Testar Conectividade das 28 Fontes" na aba Automação em `Admin.tsx`.
- **Integração:** Axios HTTP client.
- **Tratamento de erros:** Erros de conexão em uma fonte não interrompem as outras; marca como `OFFLINE` e segue para a próxima.
- **Estados vazios:** Se a tabela estiver vazia, o auto-seeder de `server.ts` popula as 28 fontes automaticamente.
- **Segurança:** Protegido por `adminAuth`.
- **Testes:** Sem testes automatizados.
- **Documentação:** Documentado em `ACTIVE_ARCHITECTURE.md`.
- **Observabilidade:** Logs de progresso e status de cada fonte no console.
- **Ambiente limpo:** Executa sem quebrar em ambiente limpo.
- **Classificação:** **COMPLETA**.

---

### 2.13. Orquestrador de Jobs (Scheduler & Discovery)
- **Backend:** Classe `Scheduler` em `src/ingestion/orchestration/Scheduler.ts`.
- **Banco:** Consulta `data_datasets`, enfileira em `data_imports` via `JobManager` e destrava jobs pendentes há mais de 1 hora (`lockedAt > 1h`).
- **Serviço:** `Scheduler` + `Discovery`.
- **Frontend:** Rota `POST /api/admin/ingestion/discovery` acionada pelo botão "Executar Discovery Nacional" em `Admin.tsx`.
- **Integração:** Ciclo com `setInterval` e trigger manual via API.
- **Tratamento de erros:** Tratamento explícito de erros de DNS (`ENOTFOUND`) quando executado offline, sem derrubar a aplicação.
- **Estados vazios:** Se não houver datasets com novas versões, não gera jobs falsos.
- **Segurança:** Rota de trigger manual protegida.
- **Testes:** Sem testes automatizados.
- **Documentação:** Documentado em `ACTIVE_ARCHITECTURE.md`.
- **Observabilidade:** Logs com prefixo `[Scheduler]` no stdout.
- **Ambiente limpo:** Inicia e aguarda sem falhas mesmo com banco zerado.
- **Classificação:** **COMPLETA**.

---

### 2.14. Seeding Geográfico e Limites Municipais IBGE
- **Backend / CLI:** Script autônomo `scripts/seed-ibge.ts` executado via `npm run seed:ibge`.
- **Banco:** Tabelas `geographic_states` e `geographic_municipalities` com dados espaciais PostGIS.
- **Serviço:** Download e parsing das APIs oficiais de malhas do IBGE.
- **Frontend:** N/A (consumido internamente para georreferenciamento).
- **Integração:** API REST de dados abertos do IBGE (`servicodados.ibge.gov.br`).
- **Tratamento de erros:** Tratamento de falhas por estado, com continuação da importação para os demais estados.
- **Estados vazios:** `GeoNormalizationService` opera com fallback gracioso caso as tabelas ainda não estejam populadas.
- **Segurança:** Script administrativo para execução via console/deploy.
- **Testes:** Sem testes automatizados.
- **Documentação:** Documentado em `README-DEPLOY.md`.
- **Observabilidade:** Logs de progresso por UF no console.
- **Ambiente limpo:** Script idempotente (`onConflictDoNothing`).
- **Classificação:** **COMPLETA**.

---

### 2.15. Gráfico de Tendências Históricas (TrendChart)
- **Backend:** No endpoint `/api/analysis` (`server.ts:261`), a chave `trend` é retornada como um array vazio fixo (`trend: []`), embora o `SafetyAnalysisService` calcule as séries temporais.
- **Banco:** O banco possui os dados temporais necessários em `security_occurrences` e `security_indicators`.
- **Serviço:** O serviço possui o cálculo, mas a saída não está sendo propagada para o payload final entregue pelo `server.ts`.
- **Frontend:** O componente `TrendChart.tsx` está pronto e funcional com `Recharts` (AreaChart com degradê), mas como recebe array vazio, o gráfico não é plotado na tela de resultados.
- **Integração:** Ruptura no conector entre `SafetyAnalysisService` e `server.ts`.
- **Tratamento de erros:** Trata array vazio sem crash.
- **Estados vazios:** Permanece invisível ou sem dados no frontend.
- **Segurança:** N/A.
- **Testes:** Sem testes automatizados.
- **Documentação:** Apenas mencionada em inventários anteriores.
- **Observabilidade:** Ausente.
- **Ambiente limpo:** Não quebra, mas não entrega a funcionalidade ao usuário.
- **Classificação:** **PARCIAL**.

---

### 2.16. API Pública Versionada (Open Data V1)
- **Backend:** `src/api/public.ts` implementa rotas `/api/public/v1/indicators` e `/api/public/v1/occurrences`, com rate limit e checagem de chave.
- **Banco:** Consultas eficientes em `security_indicators` e `security_occurrences`, com bounding box PostGIS.
- **Serviço:** Roteador montado no Express.
- **Frontend:** Página `ApiDocs.tsx` exibe exemplos de curl, parâmetros e respostas.
- **Integração / Divergência:** **Existe uma divergência entre a documentação e o backend**:
  - `ApiDocs.tsx` informa que `/indicators` aceita `startDate`, `endDate`, `state`.
  - `src/api/public.ts` espera `uf`, `category`, `period`.
  - A autenticação valida contra `process.env.PUBLIC_API_KEY || 'test_api_key_123'` (chave estática em memória, sem emissão ou controle por usuário no banco).
- **Tratamento de erros:** Try/catch básico retornando 500 genérico.
- **Estados vazios:** Retorna coleções vazias válidas `{ meta: { count: 0 }, data: [] }`.
- **Segurança:** Rate limit ativo, mas chave estática compartilhada.
- **Testes:** Sem testes automatizados de integração HTTP.
- **Documentação:** Divergente do código da rota.
- **Observabilidade:** Logs de aviso básicos.
- **Ambiente limpo:** Funciona perfeitamente.
- **Classificação:** **PARCIAL**.

---

### 2.17. Acompanhamento de Região e Alertas (Watch Region)
- **Backend:** Rotas `POST /api/user/alerts` e `GET /api/user/alerts` persistem e leem registros em `region_watchlists`.
- **Banco:** Tabela `region_watchlists` existe com campos adequados (`userId`, `latitude`, `longitude`, `radiusMeters`, `lastScore`).
- **Serviço:** **Inexistente**. Não há rotina agendada ou worker que compare os scores antigos com novos dados ingeridos, e não há serviço de disparo de e-mail, push ou webhook.
- **Frontend:** Botão `WatchRegionButton.tsx` na tela de resultados envia POST fixo com `userId: 'guest-user'` (placeholder hardcoded). Não existe tela para o usuário visualizar, editar ou remover suas regiões acompanhadas.
- **Integração:** Salva no banco, mas o ciclo é interrompido aí.
- **Tratamento de erros:** Retorna 400 se faltar campos obrigatórios.
- **Estados vazios:** Botão apenas transiciona para o rótulo "Acompanhando".
- **Segurança:** Inseguro: qualquer cliente pode gravar registros no banco sob o identificador público `guest-user`.
- **Testes:** Sem testes automatizados.
- **Documentação:** Inexistente.
- **Observabilidade:** `logger.error("Failed to save watchlist")`.
- **Ambiente limpo:** Grava no banco sem erros, mas não tem utilidade real para o usuário final.
- **Classificação:** **INCOMPLETA**.

---

### 2.18. Validação dos 27 Adapters Estaduais
- **Backend:** 27 classes concretas criadas em `src/ingestion/adapters/*` herdando de `BaseAdapter` e registradas no `Worker.ts`.
- **Banco:** Schemas preparados para receber ocorrências e indicadores de todos os estados.
- **Serviço:** Classes implementam `parseRow` com mapeamentos das colunas esperadas de cada SSP/SESP.
- **Frontend:** Status das 28 fontes visível no painel administrativo.
- **Integração:** **Não validada com arquivos reais de cada estado**. Apenas SSP-SP e SINESP foram testados com amostras concretas de dados abertos. Os demais 25 estados ainda não foram confrontados contra planilhas reais de seus respectivos portais.
- **Tratamento de erros:** Implementado no código via retorno de `null` em linhas inválidas, mas não testado contra anomalias reais de layout governamental.
- **Estados vazios:** Tratados em código.
- **Segurança:** Sem execução de código externo.
- **Testes:** Sem suite de testes unitários com fixtures de CSV de cada estado.
- **Documentação:** Documentado em `data-sources.md`.
- **Observabilidade:** Métricas do worker.
- **Ambiente limpo:** Compilado e pronto, mas sem validação de produção para 25 estados.
- **Classificação:** **NÃO VALIDADA**.

---

## 3. Detalhamento das Funcionalidades Não Concluídas

### 3.1. Gráfico de Tendências Históricas (`TrendChart`)
- **O que já existe:**
  - Componente visual `src/components/TrendChart.tsx` completo e estilizado com Recharts (AreaChart com degradê âmbar, formatação de meses em português e tooltip customizado).
  - Cálculo de séries temporais disponível dentro do `SafetyAnalysisService.ts`.
- **O que falta:**
  - Conectar o retorno do cálculo de tendência de `SafetyAnalysisService` na resposta do endpoint `GET /api/analysis` em `server.ts`, substituindo o placeholder estático `trend: []` pelos dados calculados.
  - Exibir o componente `TrendChart` na tela `Result.tsx` alimentado por essa chave.
- **Dependências:** `SafetyAnalysisService.ts`, `server.ts` e `Result.tsx`.
- **Risco:** Baixo. Ambos os lados já estão implementados; trata-se apenas de repassar a propriedade.
- **Esforço estimado:** Muito baixo (~15 minutos).
- **Critério objetivo de pronto:** A requisição `GET /api/analysis` retornar array de objetos `{ month: "YYYY-MM", count: number }` e o gráfico de tendência ser renderizado visualmente na tela de resultados quando houver dados temporais disponíveis.

---

### 3.2. API Pública Versionada (Open Data V1)
- **O que já existe:**
  - Roteador `src/api/public.ts` funcional com rotas `/v1/indicators` e `/v1/occurrences`.
  - Rate limiter de 100 requisições a cada 15 minutos por IP.
  - Filtros espaciais PostGIS na rota de ocorrências.
  - Tela de documentação interativa em `src/pages/ApiDocs.tsx`.
- **O que falta:**
  - Unificar os nomes dos parâmetros entre `ApiDocs.tsx` e `public.ts` (padronizar `state` vs `uf`, `startDate`/`endDate` vs `period`).
  - Definir se a chave de API é estática para dados abertos públicos (removendo a obrigatoriedade de chave e mantendo apenas o rate limit) ou se haverá persistência de chaves por desenvolvedor.
- **Dependências:** `src/api/public.ts` e `src/pages/ApiDocs.tsx`.
- **Risco:** Baixo.
- **Esforço estimado:** Baixo (~30 minutos).
- **Critério objetivo de pronto:** Um desenvolvedor executar o comando curl documentado em `ApiDocs.tsx` e obter resposta `200 OK` com dados consistentes sem incompatibilidade de parâmetros.

---

### 3.3. Acompanhamento de Região e Alertas (Watch Region)
- **O que já existe:**
  - Tabela `region_watchlists` no PostgreSQL.
  - Endpoints `POST /api/user/alerts` e `GET /api/user/alerts`.
  - Componente `WatchRegionButton.tsx` na tela de resultados.
- **O que falta:**
  - Sistema de identidade e autenticação de usuário (atualmente gravado com `userId: 'guest-user'`).
  - Tela ou modal de listagem das regiões acompanhadas pelo usuário.
  - Serviço de comparação de scores em background pós-ingestão de novos dados.
  - Canal de notificação (disparo de e-mail via Resend/SendGrid ou webhooks).
- **Dependências:** Autenticação de usuários, serviço de mensageria/e-mail e worker de verificação periódica.
- **Risco:** Médio-Alto (envolve múltiplos módulos que ainda não existem no projeto).
- **Esforço estimado:** Alto (~2 a 3 dias de trabalho).
- **Critério objetivo de pronto:** Usuário autenticado salvar uma região, o sistema ingerir novos dados criminais daquela área, detectar alteração estatística no Score e enviar um e-mail com o alerta e link para a análise comparativa.

---

### 3.4. Validação dos 27 Adapters Estaduais
- **O que já existe:**
  - Todas as 27 classes concretas de adapters implementadas herdando de `BaseAdapter`.
  - Registro de todas as fontes no `Worker.ts`.
  - Normalização unificada via `Taxonomy.ts`.
- **O que falta:**
  - Fixtures de teste com arquivos de amostra reais de cada uma das 25 secretarias estaduais ainda não testadas.
  - Validação de formato de cabeçalho, encoding (UTF-8 vs ISO-8859-1), separadores (vírgula vs ponto-e-vírgula) e formatos de data específicos de cada estado.
- **Dependências:** Obtenção de arquivos de amostra oficiais de cada portal de transparência estadual.
- **Risco:** Médio (layouts governamentais frequentemente divergem do padrão ou sofrem alterações).
- **Esforço estimado:** Médio-Alto (~1 a 2 dias para coleta e validação por estado).
- **Critério objetivo de pronto:** Cada um dos 27 adapters processar com sucesso um arquivo real de seu respectivo estado através do `IngestionWorker`, gerando registros válidos em `security_occurrences` ou `security_indicators` com 0 erros fatais no job.

---

## 4. Priorização para Conclusão

Com o objetivo de **terminar o que já existe antes de adicionar novas funcionalidades**, as pendências foram organizadas estritamente por impacto no produto:

### Prioridade P0 — Bloqueia o Funcionamento Principal
*Nenhuma funcionalidade central está em estado bloqueante.* O fluxo principal de consulta de endereço, mapa, cálculo de score, inteligência artificial e dashboard nacional está 100% operacional.

### Prioridade P1 — Importante para o Produto (Ajustes Imediatos)
1. **Conexão do Gráfico de Tendências Históricas (`TrendChart`):**
   - *Ação:* Repassar os dados de `trend` já calculados pelo `SafetyAnalysisService` no payload do endpoint `/api/analysis` em `server.ts` e renderizar o card de gráfico na tela de resultados.
   - *Impacto:* Entrega imediata da análise visual da série histórica para o usuário final sem criar código novo.
2. **Harmonização da API Pública V1 e Documentação (`ApiDocs` / `public.ts`):**
   - *Ação:* Alinhar os nomes dos parâmetros entre a rota `public.ts` e a documentação `ApiDocs.tsx`, simplificando a autenticação para acesso público aberto com rate limit.
   - *Impacto:* Garante que a API para desenvolvedores funcione exatamente como documentada.

### Prioridade P2 — Secundária (Validação e Robustez)
3. **Validação Gradual dos Adapters Estaduais com Fixtures Reais:**
   - *Ação:* Testar e validar os parsers dos estados prioritários (RJ, MG, RS, PR, BA, PE, CE, DF, GO) com arquivos reais de dados abertos para garantir que os cabeçalhos e encodings correspondam aos portais estaduais ativos.
   - *Impacto:* Expande a cobertura de dados detalhados com precisão comprovada.

### Prioridade P3 — Pode ser Adiada ou Removida do Escopo Atual
4. **Sistema Completo de Alertas por E-mail / Notificações (`Watch Region`):**
   - *Ação:* Como requer uma camada inteira de autenticação de usuários e serviço de disparo de e-mails/webhooks externos, deve permanecer desativada na interface ou rotulada como "Em breve" até que a infraestrutura de contas de usuários seja formalmente priorizada.
   - *Impacto:* Evita alimentar expectativas de alertas que atualmente não disparam notificações reais.
