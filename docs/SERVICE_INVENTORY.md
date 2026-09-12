# Inventário de Serviços

## Core Services
| Nome | Status | Responsabilidade | Dependências | Risco / Substituto | Ação Recomendada |
| --- | --- | --- | --- | --- | --- |
| `SafetyAnalysisService.ts` | REAL | Consulta banco, faz fallback município/estado, gera o "score" de segurança. | `Taxonomy.ts`, DB Schema | Central para a aplicação. Alta complexidade matemática. | Isolar regra de negócio em funções menores. |
| `GeocodingService.ts` | REAL | Consulta Nominatim/ViaCEP e guarda em `geocoding_cache`. | External APIs, DB | Alto risco de Rate Limit. | Manter, otimizar cache. |
| `GeoNormalizationService.ts` | REAL | Normaliza nomes de bairros/cidades (remove acento, caixa alta). | Nenhuma | Baixo | Manter. |
| `SummaryService.ts` | REAL | Conecta-se à API do Gemini e gera texto descritivo. | Gemini SDK, DB `generated_summaries` | Falha se API key faltar ou acabar cota. | Manter e tratar erros amigáveis. |
| `Taxonomy.ts` | REAL | Dicionário global de tipificações criminais (de/para). | Nenhuma | Se desatualizado, dados novos viram 'outros'. | Expandir mapeamento progressivamente. |

## Ingestion & Pipeline
| Nome | Status | Responsabilidade | Dependências | Risco / Substituto | Ação Recomendada |
| --- | --- | --- | --- | --- | --- |
| `DataIngestionService.ts` | DUPLICADO | Inserção antiga síncrona. | DB | Duplica a lógica do `Worker.ts`. | **Deletar** após migração 100% para Jobs. |
| `JobManager.ts` | REAL | Cria os registros em `data_imports` / `ingestion_jobs` com status `QUEUED`. | DB | Baixo. | Manter como porta de entrada de filas. |
| `Storage.ts` (RawStorage) | REAL | Salva o CSV físico no disco (`/raw_storage`). | `fs`, `path` | Perde arquivos em Containers efêmeros (Cloud Run) se reiniciar. | Em Cloud Run, mudar para Cloud Storage (GCS/S3). |
| `Worker.ts` | REAL | O motor principal que pega do RawStorage, faz chunking e insere via Adapters. | Adapters, DB | Baixo | Manter como centralizador da Ingestão V2. |
| `JobWorker.ts` | DUPLICADO/CONFUSO | Outro worker criado para ler da fila e inserir. Conflita conceitualmente com `Worker.ts`. | DB | Concorrência e duplicidade lógica. | Consolidar com `Worker.ts`. |
| `AutoDownloader.ts` | PARCIAL | Faz `axios.head` para checar se portais estão online. | DB `dataSources` | Não faz o download de verdade ainda. | Evoluir para web scraper ou renomear. |

## Adapters
| Adaptador | Status | Responsabilidade | Ação Recomendada |
| --- | --- | --- | --- |
| `SspSpAdapter.ts` | REAL | Lê formato específico da SSP São Paulo e transforma para canonical. | Manter e expandir se SSP mudar formato. |
| `SinespAdapter.ts` | MOCK | Lê CSV de amostra (deletado) ou retorna hardcoded. | Reescrever para raspar/ler formato real do Gov. Fed. |
| `IbgeSyncService.ts` | PARCIAL | Sincroniza polígonos IBGE via API externa. | Verificar se baixa corretamente a malha. |
| Outros 26 Estados (`IspRj`, `SspMg`, etc) | NÃO IMPLEMENTADO | Estão vazios herdando de `BaseAdapter`. | Deixar de molho até iniciar implementação de cada um. |
