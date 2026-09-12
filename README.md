# Public Security Platform

Plataforma de inteligência, transparência e análise georreferenciada de dados de segurança pública baseada em fontes governamentais abertas oficiais (SSP-SP, SINESP e secretarias de segurança estaduais).

---

## 1. Visão Geral e Arquitetura Real

A plataforma opera em arquitetura Full-Stack orientada a alta integridade e confiabilidade de dados públicos:

```
[ Frontend SPA (React 18 + Vite + Tailwind + Recharts) ]
                            │
               HTTP / JSON (REST API)
                            ▼
[ Backend Express.js Server (Node.js + TypeScript / TSX) ]
  ├── Middleware de Observabilidade (x-request-id, Latência p50/p95, Rate Limit)
  ├── SafetyAnalysisService (Score Gravimétrico, Decaimento Espacial/Temporal)
  ├── GeoNormalizationService (IBGE Módulo 10, Bounds Brasil, Topônimos)
  ├── SummaryService (Google Gemini AI com Fallback Determinístico Offline)
  └── PipelineAutomationService & IngestionWorker (ETL, Quality Gate, RAW Storage)
                            │
               Drizzle ORM (Type-Safe SQL)
                            ▼
[ Camada de Persistência: PostgreSQL com PostGIS (com Fallback Local SQLite/LibSQL) ]
```

---

## 2. Status Real das Fontes de Dados e Integração

- **SSP-SP (Secretaria de Segurança Pública de São Paulo)**:
  - **Status**: Operacional para Ingestão e Processamento.
  - **Automação**: O ciclo realiza checagem remota de saúde e conectividade da URL oficial (`AutoDownloader.ts`). Devido às restrições de formulários dinâmicos e sessões ASPX WebForms do portal governamental, o recebimento de arquivos brutos ocorre via upload de arquivo no painel administrativo (`/api/admin/upload-ssp`) ou via repositório RAW Storage (`storage/raw/`). Uma vez recebido, o arquivo é processado, validado e deduplicado 100% de forma autônoma.
  - **Dados**: Microdados de Boletins de Ocorrência (BO) com coordenadas pontuais (latitude/longitude), endereço e delegacia, e séries mensais municipais.

- **SINESP (Sistema Nacional de Informações de Segurança Pública - MJSP)**:
  - **Status**: Adapter implementado (`SinespAdapter.ts`), download autônomo bloqueado na origem governamental.
  - **Situação da Fonte Remota**: O endpoint remoto histórico (`dados.mj.gov.br`) foi descontinuado pelo Governo Federal (DNS NXDOMAIN). A nova plataforma `dados.gov.br` exige autenticação via Bearer token e os portais `gov.br/mj` utilizam proteção WAF contra scraping.
  - **Modo de Operação**: O adapter bloqueia requisições automatizadas frágeis e orienta a carga manual de planilhas/CSVs oficiais extraídos do portal através da rota de upload.

- **Secretarias Estaduais (27 UFs)**:
  - **Status**: Adapters e Parsers implementados para todas as 27 UFs no diretório `src/ingestion/adapters/`.
  - **Modo de Operação**: Devido à ausência de APIs padronizadas e presenças de CAPTCHA/WAF nos portais estaduais, os dados de microdados e indicadores são ingeridos via upload de arquivos oficiais ou arquivos locais preservados.

- **IBGE (Instituto Brasileiro de Geografia e Estatística)**:
  - Base canônica de códigos de municípios (7 dígitos com dígito verificador módulo 10) e limites territoriais para normalização toponímica.

---

## 3. Metodologia de Cálculo e Transparência

### Score de Segurança Gravimétrico (0 a 100)
- **Ponderação por Severidade**: Crimes violentos contra a vida (homicídios, latrocínios) possuem maior peso relativo em relação a crimes patrimoniais sem violência (furtos).
- **Decaimento Espacial**: Ocorrências próximas ao ponto consultado possuem peso gravitacional decrescente até o limite do raio selecionado.
- **Decaimento Temporal**: Registros recentes possuem peso superior a ocorrências do início do período de referência.
- **Regras Rígidas de Integridade**:
  - A API **nunca inventa dados** e **nunca retorna score zero** por ausência de dados.
  - Se a região não possui dados suficientes, o status retornado é `"insufficient_data"` com score nulo (`null`) e indicação dos dados ausentes.
  - Ausência de registros oficiais **não significa ausência de criminalidade** (subnotificação).

### Confiança e Fallbacks
- **Índice de Confiança (%)**: Avalia a densidade, completude espacial e recência dos dados oficiais disponíveis.
- **Transparência de Granularidade**: Quando microdados pontuais não existem para o raio, a plataforma utiliza agregação municipal ou estadual com nota explícita de transparência (`fallback.disclosure`).

---

## 4. Pipeline de Ingestão e Persistência de Indicadores

O pipeline de dados opera em etapas estruturadas em `src/ingestion/pipeline/Worker.ts` e `PipelineAutomationService.ts`:
1. **Identificação e Checksum SHA-256**: Geração de hash do arquivo RAW para evitar reprocessamento idêntico.
2. **Armazenamento RAW Imutável**: Arquivos brutos preservados intactos no diretório de armazenamento (`storage/raw/`).
3. **Quality Gate de Esquema**: Validação de colunas obrigatórias e rejeição automática se a taxa de inconsistência for > 50%.
4. **Ingestion Worker em Lotes**: Processamento em stream com inserção em lotes atômicos.
5. **Deduplicação Determinística**: Chave única `(source_id, source_record_id)` previne duplicidades.
6. **Agregação e UPSERT em `security_indicators`**: O método `PipelineAutomationService.recalculateIndicatorsForState()` executa a consolidação municipal de ocorrências e realiza a persistência atômica via `UPSERT` na tabela `security_indicators`.
7. **Recuperação de Jobs Presos**: Liberação automática de locks expirados na tabela de controle `data_imports`.

---

## 5. Observabilidade e Métricas

A plataforma expõe métricas e rastreamento em tempo real:
- **`x-request-id`**: Identificador único UUID por requisição HTTP, propagado em logs estruturados.
- **Métricas de Latência**: Cálculo contínuo de percentis **p50, p95 e p99** de resposta da API em `src/lib/metrics.ts`.
- **Endpoint `/api/metrics`**: Exposição de métricas de tráfego, erros e latência.
- **Métricas Operacionais de Ingestão**: Expostas via `/api/admin/pipeline/operational-status` e `/api/admin/ingestion/status` detalhando status da fonte, última tentativa, registros lidos/válidos/inseridos, taxa de inválidos, duplicidades e diagnóstico de atraso.

---

## 6. Endpoints da API

### Públicos
- `GET /api/analysis?lat=-23.5505&lon=-46.6333&radius=1000&period=12m`
  - Retorna o Score de Segurança, confiança, distribuição por categorias, dados ausentes, fontes oficiais, notas de transparência e sumário explicativo.
- `GET /api/sources`
  - Lista as fontes integradas, status de operação e última data de sincronização.
- `GET /api/health`
  - Diagnóstico de saúde do backend e conectividade com o banco de dados.
- `GET /api/metrics`
  - Resumo de métricas operacionais e latência (p50/p95).

### Administrativos (Protegidos por middleware `adminAuth`)
- `GET /api/admin/pipeline/operational-status?source=SSP-SP`
  - Relatório detalhado das métricas operacionais e histórico de jobs.
- `GET /api/admin/ingestion/status`
  - Status consolidado do pipeline de ingestão e histórico de importações.
- `POST /api/admin/upload-ssp`
  - Ingestão de arquivos CSV/XLSX oficiais com acionamento automático do pipeline de processamento.
- `POST /api/admin/automation/trigger-all`
  - Execução manual do ciclo de checagem e automação.
- `POST /api/admin/pipeline/reprocess/:jobId`
  - Reprocessamento idempotente de lote a partir do arquivo RAW.

---

## 7. Execução Local e Fallback de Banco de Dados

### Pré-requisitos
- Node.js 18+ (Node 20+ recomendado)
- npm 9+

### Passos
1. **Configurar variáveis de ambiente**:
   ```bash
   cp .env.example .env
   ```
2. **Instalar dependências**:
   ```bash
   npm install
   ```
3. **Executar em desenvolvimento**:
   ```bash
   npm run dev
   ```
   O servidor Express e a interface Vite estarão acessíveis na porta `3000` (`http://localhost:3000`).

### Persistência Relacional e Fallback
- **Produção**: Utiliza PostgreSQL com a extensão PostGIS para consultas geoespaciais indexadas (`GIST` em colunas `geom`).
- **Fallback de Desenvolvimento/Testes**: Quando o PostgreSQL não está configurado ou acessível, o sistema inicializa automaticamente o SQLite/LibSQL local (`data/local_radar.db`), permitindo execução completa de testes e desenvolvimento sem dependências externas.

---

## 8. Execução de Testes e Suítes de Confiabilidade

- **Suíte Completa de Confiabilidade (18 Tópicos)**:
  ```bash
  npm test
  ```
- **Auditoria de Confiabilidade de IA (Prompt Injection & Hallucination Prevention)**:
  ```bash
  npm run test:ai
  ```
- **Auditoria de Persistência de Indicadores**:
  ```bash
  npx tsx tests/indicator_aggregation_persistence_audit.ts
  ```
- **Auditoria de Integração PostgreSQL/PostGIS**:
  ```bash
  npx tsx tests/postgres_postgis_integration_audit.ts
  ```

---

## 9. Limitações Reais dos Dados

- **Dependência de Publicação Governamental**: Defasagem na publicação oficial das secretarias estaduais (ex: SSP-SP publica por volta do dia 25 do mês subsequente).
- **Descontinuidade de Portais Federais**: Endpoints antigos como `dados.mj.gov.br` (SINESP) foram descontinuados, exigindo carga via upload manual.
- **Geocodificação**: Microdados de BO contêm coordenadas pontuais georreferenciadas; tabelas de séries mensais agregadas não possuem coordenadas de rua e utilizam centroide municipal.
- **Subnotificação**: Registros oficiais refletem exclusivamente boletins lavrados pelas forças de segurança.

---

**Public Security &copy; 2026** — Transparência e Integridade em Dados Públicos.
