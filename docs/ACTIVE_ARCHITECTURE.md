# Arquitetura Ativa e Oficial — Radar Criminal Brasil

Este documento define a **arquitetura consolidada, oficial e única** do projeto, eliminando fluxos paralelos, tabelas concorrentes e camadas duplicadas.

---

## 1. Fluxo Canônico de Dados

Todo e qualquer dado que entra na plataforma deve seguir rigorosamente o pipeline linear:

```
[1. Source]
      │
      ▼
[2. Dataset]
      │
      ▼
[3. Download / Ingestão de Stream]
      │
      ▼
[4. Raw Storage (raw_storage/)]
      │
      ▼
[5. Schema Validation]
      │
      ▼
[6. Parser (CSV Streaming)]
      │
      ▼
[7. Normalizer (Taxonomy + Geo IBGE)]
      │
      ▼
[8. Quality Gate (Validação de Coordenadas, Datas e Integridade)]
      │
      ▼
[9. Deduplication (ON CONFLICT DO NOTHING / UPDATE)]
      │
      ▼
[10. Persistence (PostgreSQL + PostGIS)]
      │
      ▼
[11. Indicators & Invalidation (Recálculo On-demand + analysisCache.clear())]
      │
      ▼
[12. Publication (APIs Públicas, Dashboard e Mapa)]
```

---

## 2. Matriz de Responsabilidades (Quem Faz o Quê)

| # | Responsabilidade | Componente Responsável | Arquivo Principal | Descrição |
|---|---|---|---|---|
| **1** | **Orquestração de Jobs** | `Scheduler` | `src/ingestion/orchestration/Scheduler.ts` | Dispara verificações periódicas de novas versões de dados (`Discovery`), enfileira jobs oficiais e recupera jobs travados (`lockedAt > 1h`). |
| **2** | **Execução de Jobs** | `IngestionWorker` | `src/ingestion/pipeline/Worker.ts` | Processa continuamente a fila com locking atômico concorrente (`FOR UPDATE SKIP LOCKED`), gerencia retries e checkpoints. |
| **3** | **Download e Recepção de Arquivos** | Stream Ingestion / Upload API | `server.ts` (`/api/admin/upload-ssp`) / `Storage.put()` | Recebe streams de arquivos oficiais (via upload ou download HTTP) e transfere diretamente para o armazenamento bruto. |
| **4** | **Armazenamento RAW** | `RawStorage` | `src/ingestion/pipeline/Storage.ts` | Persistência imutável em disco particionado (`raw_storage/{datasetId}/{version}/{filename}`), calculando SHA-256 e tamanho de arquivo durante o stream. |
| **5** | **Seleção de Adapter** | Adapter Registry no Worker | `src/ingestion/pipeline/Worker.ts` | Mapeia o `source_id` do job para a classe concreta de adapter especializada (27 estados + SINESP). |
| **6** | **Normalização de Dados** | Adapters + `Taxonomy` + `GeoNormalizationService` | `src/ingestion/adapters/*`, `src/services/Taxonomy.ts`, `src/services/GeoNormalizationService.ts` | Converte taxonomias locais para a taxonomia canônica nacional (`CanonicalCategory`) e mapeia municípios para códigos IBGE. |
| **7** | **Validação de Qualidade (Quality Gate)** | Quality Gate no Worker | `src/ingestion/pipeline/Worker.ts` | Filtra e contabiliza registros válidos, inválidos, sem coordenadas e com inconsistências temporais antes da persistência. |
| **8** | **Deduplicação** | Worker + Constraints PostGIS | `src/ingestion/pipeline/Worker.ts` | Ocorrências: `ON CONFLICT DO NOTHING`. Indicadores agregados: `ON CONFLICT (source_id, state_code, municipality_code, category, period) DO UPDATE SET value = EXCLUDED.value`. |
| **9** | **Persistência** | Worker (Batch Engine) | `src/ingestion/pipeline/Worker.ts` | Inserção em lotes de até 2.000 registros no PostgreSQL com PostGIS nas tabelas `security_occurrences` e `security_indicators`. |
| **10** | **Recálculo de Indicadores** | `SafetyAnalysisService` | `src/services/SafetyAnalysisService.ts` | Agregação espacial (`ST_DWithin`, bounding box e haversine), pontuação de segurança e cálculo de confiança sob demanda. |
| **11** | **Invalidação de Cache** | Worker + `analysisCache` | `src/lib/cache.ts`, `src/ingestion/pipeline/Worker.ts` | Ao transitar um job para `COMPLETED`, o Worker executa `analysisCache.clear()` garantindo que consultas reflitam dados novos imediatamente. |
| **12** | **Registro de Falhas e Telemetria** | Worker + Scheduler + `logger` | `src/ingestion/pipeline/Worker.ts`, `src/lib/logger.ts` | Gravação de `last_error`, `failed_at`, tentativas em `data_imports` e logs estruturados em formato JSON no stdout. |

---

## 3. Componentes Oficiais do Sistema

### 3.1. Ingestão e Orquestração
- **`src/ingestion/orchestration/Scheduler.ts`**: Orquestrador central periódico. Monitora `data_datasets`, executa `Discovery.checkForUpdates` e enfileira em `data_imports` via `JobManager`.
- **`src/ingestion/orchestration/Discovery.ts`**: Lógica de verificação de novas versões por fonte.
- **`src/ingestion/pipeline/JobManager.ts`**: Fábrica e gerenciador único de ciclo de vida de jobs na tabela oficial `data_imports`.
- **`src/ingestion/pipeline/Worker.ts` (`IngestionWorker`)**: Processador assíncrono oficial.
- **`src/ingestion/pipeline/Storage.ts` (`RawStorage`)**: Gerenciador oficial de arquivos brutos.
- **`src/ingestion/pipeline/SourcePriority.ts`**: Matriz de precedência oficial (SSP Estadual > SINESP Federal).
- **`src/ingestion/adapters/*`**: 27 adapters estaduais e 1 adapter federal (`SinespAdapter.ts`), todos herdando de `BaseAdapter`.

### 3.2. Serviços de Domínio e Inteligência
- **`src/services/SafetyAnalysisService.ts`**: Motor analítico central. Calcula o Score de Segurança (0–100), nível de confiança, tendências e dados pontuais de ocorrências para coordenadas geográficas e raios.
- **`src/services/Taxonomy.ts`**: Taxonomia canônica nacional. Unifica mais de 80 tipificações penais locais em 7 categorias canônicas (`violent_crime`, `property_crime`, `vehicle_theft`, `cargo_theft`, `lethal_crime`, `fraud`, `other`).
- **`src/services/GeoNormalizationService.ts`**: Normalização sem acentos, caixa-baixa e mapeamento de variantes municipais para códigos IBGE oficiais.
- **`src/services/GeocodingService.ts`**: Geocodificação reversa e direta.
- **`src/services/SummaryService.ts`**: Resumos analíticos qualitativos via modelo oficial Gemini (`gemini-3.6-flash`).

### 3.3. Banco de Dados e Schemas Oficiais
- **Tabela de Jobs e Qualidade:** `data_imports` (armazena status, lock, métricas de qualidade e caminhos brutos).
- **Tabela de Ocorrências:** `security_occurrences` (dados pontuais com geometria PostGIS `POINT` SRID 4326).
- **Tabela de Indicadores:** `security_indicators` (séries temporais agregadas por município, estado, categoria e período).
- **Tabelas Geográficas:** `geographic_states` e `geographic_municipalities` (geometrias IBGE).
- **Tabelas de Fontes e Datasets:** `data_sources` e `data_datasets`.

### 3.4. Interfaces e APIs
- **Servidor:** `server.ts` (Express + Vite).
- **API Pública Versionada:** `src/api/public.ts` (montada em `/api/public/v1/*`, rate-limited e com chave `X-API-Key`).
- **Health Check e Diagnóstico:** `src/api/health.ts` (montada em `/health` e `/api/health`).
- **Painel Administrativo:** `src/pages/Admin.tsx` (consome `/api/admin/data-quality`, `/api/admin/ingestion/status` e `/api/admin/upload-ssp`).

---

## 4. Componentes Removidos na Consolidação

1. **`src/ingestion/orchestration/JobWorker.ts`**:
   - *Motivo:* Worker mock de protótipo que criava arquivos temporários falsos e concorria com o worker real.
   - *Substituto:* `IngestionWorker` oficial em `src/ingestion/pipeline/Worker.ts`.
2. **`src/db/schema_v2.ts`**:
   - *Motivo:* Schema SQLite órfão incompatível com o banco oficial PostgreSQL/PostGIS.
   - *Substituto:* `src/db/schema.ts`.
3. **`src/ingestion/adapters/geographic/ibge/IbgeSyncService.ts`**:
   - *Motivo:* Engine legada de sincronização de limites acoplada a rota extinta.
   - *Substituto:* Script oficial de seed `scripts/seed-ibge.ts` (`npm run seed:ibge`).
4. **Tabela paralela `ingestion_jobs`**:
   - *Motivo:* Duplicação da fila de processamento que criava divergência entre o Scheduler e o Worker.
   - *Substituto:* Tabela canônica `data_imports`, gerenciada por `JobManager`.
5. **Endpoints stubs e de dados simulados**:
   - `POST /api/admin/ingestion/jobs/:id/retry` (stub sem ação).
   - Mock com dados fictícios de 2026 em `/api/admin/ingestion/status`.
   - Rota legada de debug que gravava `/tmp/env.log` no health check.

---

## 5. Componentes Temporários e Transições

1. **`analysisCache` em memória (LRU Cache):**
   - *Estado atual:* Armazena análises geoespaciais em memória de processo único (`src/lib/cache.ts`).
   - *Evolução futura:* Caso a aplicação escale para múltiplos pods/containers, migrar para Redis/KeyDB.
2. **`AutoDownloader.ts` (`src/ingestion/orchestration/AutoDownloader.ts`):**
   - *Estado atual:* Atua estritamente como checador de disponibilidade HTTP (HEAD/GET) das URLs oficiais cadastradas em `data_sources`. Mantido para o botão de diagnóstico do painel admin.

---

## 6. Regras Rígidas para Novos Adapters

Qualquer novo adapter estadual ou temático adicionado ao projeto **DEVE**:
1. **Herdar de `BaseAdapter`**: Implementar obrigatoriamente a interface base.
2. **Streaming e Baixo Consumo de Memória**: O método `parseRow(row: any)` deve processar linha a linha, sem carregar arquivos inteiros em memória.
3. **Mapeamento de Taxonomia Canônica**: Todas as tipificações penais locais devem ser traduzidas para `CanonicalCategory` via `Taxonomy.ts`.
4. **Separação entre Ocorrências e Indicadores**:
   - Se os dados contêm latitude/longitude pontual ou endereço, emitir `target: 'occurrences'`.
   - Se os dados são totais consolidados mensais por município/estado, emitir `target: 'indicators'`.
5. **Registro Centralizado no Worker**: Deve ser adicionado ao bloco de seleção de adapters em `src/ingestion/pipeline/Worker.ts`.
6. **Nunca Bypassar o `RawStorage`**: Nenhum adapter deve ler arquivos diretamente de fontes externas ou pastas temporárias sem que o arquivo esteja devidamente registrado no `RawStorage`.

---

## 7. Regras Rígidas para Novas Funcionalidades

1. **Nunca Criar Fila de Jobs Paralela**: Toda e qualquer operação de ingestão assíncrona deve utilizar `JobManager.createJob` e ser processada pelo `IngestionWorker`.
2. **Proibido Inserir Ocorrências Fora do Worker**: Nenhum endpoint de API ou script de teste deve inserir registros diretamente em `security_occurrences` ou `security_indicators`, garantindo que métricas de qualidade, deduplicação e coordenadas passem pelo Quality Gate.
3. **Consumo Analítico Exclusivo**: Todas as telas e APIs que necessitam de estatísticas criminais e scores de segurança devem consumir `SafetyAnalysisService.analyze()`.
4. **Invalidar Cache após Mutações**: Qualquer operação que altere dados de segurança deve acionar `analysisCache.clear()`.

---

## 8. Verificação e Garantias Operacionais (Pipeline 22 Etapas)

O pipeline oficial foi validado e testado de ponta a ponta com suíte automatizada em `tests/ingestion_pipeline_e2e.ts`, cobrindo as 22 etapas canônicas:

1. **Identificação da Fonte**: Mapeamento unívoco de `source_id` registrado (ex: `SSP-SP`, `SINESP`).
2. **Identificação do Dataset**: Associação direta ao dataset canônico (`ocorrencias_criminais_sp`, `indicadores_municipais`).
3. **Verificação de Disponibilidade**: Checagem de integridade e acessibilidade via `Discovery` / `AutoDownloader`.
4. **Download**: Recepção controlada via stream direto sem carregamento integral em memória RAM.
5. **Validação do Download**: Verificação de status HTTP, stream fechado com sucesso e bytes gravados.
6. **Checksum e Versão**: Cálculo de hash SHA-256 e controle de versionamento temporal no momento do stream.
7. **Armazenamento RAW**: Gravação persistente e particionada em `raw_storage/{datasetId}/{version}/{filename}`.
8. **Criação do Job**: Inserção atômica em `data_imports` com status inicial `QUEUED` e contadores zerados.
9. **Execução pelo Worker**: Locking atômico com transição para `PROCESSING`, heartbeat e isolamento por `worker_id`.
10. **Seleção do Adapter**: Despacho automático para o adapter especializado (`SspSpAdapter`, `SinespAdapter`, etc.).
11. **Validação de Schema**: Inspeção prévia do cabeçalho CSV via `adapter.validateSchema(headers)`. Rejeição sumária se colunas estruturais obrigatórias estiverem ausentes.
12. **Parsing em Stream**: Consumo linha a linha com `csv-parse` tolerante a delimitadores (`,`, `;`), aspas e quebras de linha.
13. **Normalização**: Tradução para taxonomia canônica unificada (`CanonicalCategory`) e resolução de códigos IBGE municipais.
14. **Validação de Qualidade (Quality Gate)**: Checagem de coordenadas geográficas no polígono do Brasil (-35° a +5.5° Lat, -75° a -30° Lon), expurgo de coordenadas corrompidas e contabilização de anomalias.
15. **Deduplicação**: Filtragem em memória no mesmo lote e constraints únicas de banco com política `ON CONFLICT`.
16. **Persistência Transacional**: Inserções em lotes (`BATCH_SIZE = 1000`) nas tabelas `security_occurrences` e `security_indicators`.
17. **Atualização dos Indicadores**: Persistência de métricas e suporte a agregações espaciais via `SafetyAnalysisService`.
18. **Invalidação de Cache**: Limpeza atômica do cache em memória `analysisCache.clear()`.
19. **Registro de Sucesso**: Atualização do job em `data_imports` para `COMPLETED`, com checkpoint final e métricas de auditoria completas.
20. **Registro de Falha**: Em caso de erro, marcação do job como `FAILED` com `last_error` descritivo e sem descarte de dados válidos preexistentes.
21. **Reprocessamento**: Método `JobManager.reprocessJob(jobId)` que restaura status `QUEUED`, zera contadores e reexecuta com segurança.
22. **Idempotência**: Prevenção ativa de reprocessamento redundante com base no checksum SHA-256 do arquivo original.

