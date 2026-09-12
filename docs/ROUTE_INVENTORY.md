# Inventário de Rotas da API

## Rotas Públicas
| Rota | Método | Status | Responsabilidade | Utilizado por | Riscos | Ação Recomendada |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/public/...` | Vários | REAL | Router para rotas públicas (ex: `/api/public/v1/...`). | Consumidores API externa | Rate limit, Segurança | Validar endpoints internos e manter. |
| `/api/geocode` | GET | REAL | Geocodificação de endereços via Nominatim/ViaCEP. | Frontend (Home/Search) | Dependência de API externa, limites de cota | Manter e monitorar cache. |
| `/api/analysis` | GET | REAL | Retorna ocorrências, indicadores e score baseado no raio/coord. | Frontend (Result/Dashboard) | Performance em raios grandes | Adicionar índices ou limite de raio. |
| `/api/summary` | POST | REAL | Gera sumário com LLM (Gemini) sobre a região. | Frontend (Result - AiSummary) | Custo/Quota de API do LLM | Implementar cache robusto (já tem `generated_summaries`). |
| `/api/dashboard/summary` | GET | REAL | Dados sumarizados para a Home/Dashboard nacional. | Frontend (Dashboard) | Query pesada se banco crescer | Criar materialized view ou cache. |
| `/api/user/alerts` | GET/POST | PARCIAL | Gestão de Alertas/Watchlists do usuário. | Frontend | Falta de Autenticação real (JWT/Sessão) | Implementar Auth antes de liberar. |
| `/api/data-sources` | GET | REAL | Lista as fontes de dados governamentais. | Frontend (Admin/Result) | Nenhum | Manter. |

## Rotas Administrativas (Protegidas por `adminAuth`)
| Rota | Método | Status | Responsabilidade | Utilizado por | Riscos | Ação Recomendada |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/admin/data-quality` | GET | REAL | Retorna métricas de qualidade (coordenadas vazias, erros). | Frontend (Admin) | Nenhum | Manter. |
| `/api/admin/upload-ssp` | POST | REAL | Upload de CSV em massa para RawStorage/Job. | Frontend (Admin) | Estouro de memória em arquivos >50MB | Migrar para presigned URL S3 no futuro. |
| `/api/admin/ingest` | POST | LEGADO/DUPLICADO | Ingestão via JSON direto no `DataIngestionService`. | Admin (via API) | Conflito com a fila do JobWorker | Depreciar em favor do upload assíncrono. |
| `/api/admin/force-db-sync` | POST | QUEBRADO | Limpa o DB e roda migrações via `child_process`. | Admin | Segurança, não roda em Serverless/Container | Remover `exec()` e usar funções do ORM. |
| `/api/admin/automation/trigger-all` | POST | REAL | Inicia o `AutoDownloader` para pingar URLs oficiais. | Frontend (Admin) | Timeout em muitos sites | Executar em background (fire-and-forget). |
| `/api/admin/download-sample` | POST | QUEBRADO | Baixa CSV de exemplo do GitHub que não existe mais. | Frontend (Admin) | Erro 404/500 | Atualizar link ou remover. |
| `/api/admin/ingestion/status` | GET | REAL | Retorna jobs pendentes/concluídos (`ingestion_jobs`). | Frontend (Admin) | Nenhum | Manter. |
| `/api/admin/ingestion/jobs/:id/retry` | POST | REAL | Retenta um job de ingestão que falhou. | Frontend (Admin) | Nenhum | Manter. |
| `/api/admin/run-engine/...` | POST | LEGADO | Endpoints antigos de ingestão de SSP, SINESP e IBGE. | Frontend | Retorna apenas mensagem de alerta | Remover código morto. |
