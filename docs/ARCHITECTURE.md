# Arquitetura e Operação (Fase 8)

## 1. Visão Geral (Diagrama Operacional)

```
[ Usuário ]
    │ (Geocoding & Score Request)
    ▼
[ Nginx / WAF (Externo) ] ─► Rate Limiter / Express Middlewares
    │
    ▼
[ API Express (Node.js) ] ─► Correlation ID & Structured Logger
    │
    ├─► /api/analysis (SafetyAnalysisService)
    │     └─► [ PostgreSQL / PostGIS ] (Queries Espaciais GIST)
    │
    ├─► /api/geocode 
    │     └─► [ Serviço Externo: Nominatim OSM ]
    │
    └─► /api/admin/* (Protegido por ADMIN_SECRET)
          └─► [ JobManager / DataIngestionService ]
```

## 2. Ingestão Durável Assíncrona

```
[ Scheduler (Cron Externo) ] ou [ Admin Upload ]
    │
    ▼
[ API POST /api/admin/* ]
    │
    ▼
[ Raw Storage Local/S3 ] (Arquivos CSV, JSON brutos retidos para auditoria)
    │
    ▼
[ PostgreSQL (data_imports) ] (Tabela de Fila)
    │  status: QUEUED
    ▼
[ Worker em Background (Node) ] 
    │  (1) `FOR UPDATE SKIP LOCKED`
    │  (2) `status = PROCESSING`
    │  (3) Parse em Stream (csv-parse) -> Mapeamento de Adapter
    │  (4) Inserções em Batch com `ON CONFLICT DO NOTHING`
    │  (5) Checkpoint Salvo a cada Batch
    │
    ▼
[ PostgreSQL (security_occurrences / indicators) ]
```

## 3. Componentes da Produção
- **Frontend Vite/React**: SPA buildado e entregue como arquivos estáticos (`/dist`).
- **Backend Express (TSX/ESBuild)**: Proxy Inverso para Frontend + Middleware de Rate Limiting (`express-rate-limit`) e Auth.
- **Banco de Dados (PostgreSQL + PostGIS)**: Engine de geometria. Migration tracking via Drizzle-kit.
- **Observabilidade**: Sistema injeta cabeçalhos rastreáveis (`x-correlation-id`) para isolar conexões. O logger exporta objetos JSON legíveis para agregadores como Datadog ou Cloud Logging.
- **Confiabilidade da Fila**: Um job abortado (falta de memória) cujo status seja `PROCESSING` há mais de 30 minutos sofrerá um resgate (Retry) por outra thread, continuando da exata linha CSV documentada na coluna `checkpoint`.

## 4. Backups e Disaster Recovery
- **Snapshot Relacional**: Ferramentas clássicas (`pg_dump`) são orquestradas pela Cloud para garantir o backup dos Metadados (Usuários/Configurações).
- **Reprocessamento a Frio**: Graças à retenção do Dado Bruto (`Raw Storage`), um incidente Catastrófico que cause corrupção de índice (Ex: Geometrias Inválidas injetadas em massa por uma fonte corrompida) pode ser revertido deletando os registros no banco relacional (Rollback de Migration) e disparando o Job Manager novamente sobre o CSV Intacto com a lógica higienizada na API, garantindo **Idempotência**.
