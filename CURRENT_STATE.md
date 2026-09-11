# Inventário e Diagnóstico Real (CURRENT_STATE.md)

Este documento mapeia o estado atual do projeto **Public Security**, detalhando o que foi efetivamente implementado, o que é legado e o que precisa ser corrigido ou desenvolvido.

## 1. Rotas da API (API Routes)

| Área | Recurso (Endpoint) | Status | Evidência | Risco | Próxima Ação |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Público** | `/api/public/...` (Router) | **REAL** | Configurado em `server.ts:60` com `publicRouter`. | Baixo | Validar implementação das subrotas. |
| **Geocoding** | `GET /api/geocode` | **REAL** | Rate limiter aplicado. Usa `GeocodingService`. | Médio (APIs Externas) | Validar resiliência Nominatim/ViaCEP. |
| **Análise** | `GET /api/analysis` | **REAL** | `SafetyAnalysisService` invocado. | Baixo | Nenhuma imediata. |
| **Sumário (AI)** | `POST /api/summary` | **REAL** | Usa `SummaryService` (depende de chaves/modelos AI). | Alto (Limites AI) | Confirmar integração com Gemini. |
| **Alertas (Usuário)** | `GET / POST /api/user/alerts` | **PARCIAL** | Rota existe, porém auth e gestão real de usuários não parecem implementados por completo (depende de cookie/session local). | Médio | Implementar Autenticação (OAuth/Supabase Auth). |
| **Dashboard** | `GET /api/dashboard/summary` | **REAL** | Coleta sumarizada para tela principal. | Baixo | Nenhuma imediata. |
| **Ingestão/Admin**| `POST /api/admin/upload-ssp` | **REAL** | Usa `multer` para upload via RawStorage -> `JobManager`. | Médio (Memória) | Testar upload com arquivos de 50MB+. |
| **Ingestão/Admin**| `POST /api/admin/ingest` | **REAL** | Ingestão manual JSON via `DataIngestionService`. | Baixo | Nenhuma. |
| **Automação/Admin**| `POST /api/admin/automation/trigger-all` | **REAL** | Instancia `AutoDownloader`. Verifica saúde de URLs. | Médio | Pode dar timeout em múltiplos governos. |
| **Banco/Admin** | `POST /api/admin/force-db-sync` | **QUEBRADO/LEGADO** | Usa `child_process` (`exec`) - bloqueado/inadequado em Cloud Run/Serverless. | **Alto** | Remover `child_process`, fazer reset via ORM. |
| **Antigo Engine** | `POST /api/admin/run-engine/...` | **LEGADO** | Substituído pelo `JobManager`. Retorna mensagem amigável. | Baixo | Apagar código morto futuramente. |
| **Download Sample**| `POST /api/admin/download-sample` | **QUEBRADO** | Tenta buscar um repositório no GitHub para exemplo de CSV antigo. | Baixo | Atualizar para um CSV real de teste ou remover. |

## 2. Tabelas do Banco de Dados (`schema.ts`)

| Área | Tabela | Status | Evidência | Risco | Próxima Ação |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Geografia** | `geographic_states`, `geographic_municipalities` | **REAL** | Índices geográficos completos (`postgis`). | Baixo | Sincronizar malha do IBGE (via `IbgeSyncService`). |
| **Segurança** | `security_occurrences` | **REAL** | Tabela granular para B.O.s individuais. | Alto (Tamanho) | Monitorar tamanho da tabela na VPS. |
| **Segurança** | `security_indicators` | **REAL** | Agregações mensais (SINESP/SSP-SP). | Baixo | Nenhuma. |
| **Análise/Cache**| `geocoding_cache`, `safety_analyses`, `locations` | **REAL** | Implementado cache local. | Baixo | Limpeza periódica do cache. |
| **Metadados** | `data_sources` | **REAL** | Cadastro de órgãos federais e estaduais (SINESP, SSPs). | Baixo | Manter atualizada a lista de URLs governamentais. |
| **Pipeline Ingestão**| `ingestion_jobs`, `data_imports`, `raw_storage` | **REAL** | Base do JobWorker. `data_imports` mantida por legado. | Baixo | Limpar `data_imports` e migrar para 100% `ingestion_jobs` (v2). |
| **Alertas (Usuário)**| `region_watchlists`, `region_alerts` | **PARCIAL** | Preparadas no schema (Fase 10), ausência de UI completa. | Baixo | Finalizar UI de Favoritos/Alertas. |
| **Sumários (AI)** | `generated_summaries` | **REAL** | Cache dos textos gerados via Gemini. | Baixo | Nenhuma. |

## 3. Serviços e Pipeline

| Área | Recurso | Status | Evidência | Risco | Próxima Ação |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ingestão Core** | `DataIngestionService` / `IngestionEngine` | **PARCIAL / LEGADO** | Convivendo com a nova arquitetura do `JobManager`. Código duplicado. | Médio | Unificar a arquitetura de extração no `Worker`. |
| **Worker / JobManager** | `JobWorker.ts`, `JobManager.ts`, `Storage.ts` | **REAL** | Onde o loop real acontece para uploads assíncronos. Lê CSV em pedaços. | Baixo | Teste de estresse com CSV de 100 mil linhas. |
| **Orquestração** | `AutoDownloader` | **REAL** | Verifica disponibilidade dos portais (HTTP HEAD/GET). | Médio | Adicionar mais *retries* em servidores instáveis do governo. |
| **Análise (Cérebro)** | `SafetyAnalysisService.ts` | **REAL** | Faz o fallback inteligente Município -> Estado -> Nacional (SINESP). | Baixo | Validar matemática estatística. |
| **Geocoding** | `GeocodingService` / `GeoNormalizationService` | **REAL** | Possui normalização e cache via ORM. | Baixo | Nenhuma. |
| **Taxonomia** | `Taxonomy.ts` | **REAL** | Unifica os nomes "HOMICÍDIO DOLOSO" para "homicide". | Baixo | Expandir mapeamento de crimes. |

## 4. Adapters (Extratores Estaduais)

O sistema possui pastas criadas para os 27 estados + SINESP.

| Adaptador | Status | Evidência | Risco | Próxima Ação |
| :--- | :--- | :--- | :--- | :--- |
| **SSP-SP (São Paulo)** | **REAL** | Feito o parse complexo de meses horizontais e verticais. Cruza IBGE via caixa-alta. | Baixo | Validar na prática com portal SSP. |
| **SINESP (Nacional)** | **MOCK / NÃO VALIDADO** | Rota original fake foi deletada. Falta construir scraper real para SINESP (que bloqueia robôs) ou via API. | **Alto** | Necessita de conta no SINESP M.J. ou parser PDF complexo. |
| **ISP-RJ, SSP-MG, etc.** | **NÃO IMPLEMENTADO / MOCK** | Os arquivos existem `.ts` (SspMgAdapter, etc.), mas contêm lógicas vazias herdando do `BaseAdapter`. | Alto | Iniciar a construção do parser `.csv`/`.xls` de RJ e MG. |

## 5. README x Realidade

- **"Vercel Serverless Ready"**: *INCORRETO/LEGADO*. O servidor usa `app.listen()` dentro de `server.ts` e possui *background workers* (`ingestionWorker.start()`). Isso conflita com o Serverless da Vercel (onde funções devem terminar rápido e não há *background loops* contínuos atrelados ao request principal sem usar CRON jobs externos). A arquitetura real desenhada aqui (Express contínuo, Worker no mesmo processo, Sqlite/PostgreSQL pools longos) é ideal para **VPS (Oracle Cloud), Cloud Run ou EC2**, e não Serveless puro.
- **Geocodificação via ViaCEP**: Não confirmada no código nativo sem acessar toda a lógica do `GeocodingService.ts` a fundo, mas as tabelas de cache e o `Nominatim` parecem prioridade.

## Conclusão: "O que realmente funciona hoje em ambiente limpo?"

1. A **UI (React) e o Mapa (Leaflet)** funcionam e carregam.
2. A rota de **Upload Admin (`/api/admin/upload-ssp`)** e o processamento de arquivo em lote (*Chunking* no Worker) funcionam perfeitamente para arquivos do formato de **São Paulo (SSP-SP)**.
3. A rota de consulta do mapa (`/api/analysis`) vai buscar no banco os dados que tiverem sido feito o upload.
4. Os **outros 26 estados e o SINESP NÃO possuem integração**. Estão vazios no banco e não têm código escrito para extraí-los automaticamente.
5. A **Automação** consegue testar se os sites dos estados estão Online, mas não baixa dados massivamente ainda (falta implementar os scrapers).
6. É necessário ajustar as variáveis de ambiente na **VPS da Oracle** para o banco rodar localmente sem os erros de DNS do Supabase (`ENOTFOUND`).
