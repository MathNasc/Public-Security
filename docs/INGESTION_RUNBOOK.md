# Runbook Operacional de Ingestão de Dados

## 1. Visão Geral do Pipeline de Produção

O pipeline oficial de ingestão do Radar de Segurança Pública opera com arquitetura desacoplada e modular baseada em:

1. **StateRegistry & Provedores**: O provedor oficial ativo é a **SSP-SP** (`SspSpProvider`).
2. **RobustDownloader**: Validação de URLs, prevenção SSRF, checagem de Magic Bytes (detecção de páginas HTML de erro com status HTTP 200) e cálculo de integridade SHA-256.
3. **JobManager com Máquina de Estados Estrita**: Estados formais (`pending`, `running`, `retrying`, `succeeded`, `succeeded_with_warnings`, `failed`, `cancelled`, `stale`, `blocked`).
4. **SchemaValidator**: Validação de layout tabular antes do parsing, permitindo alterações compatíveis e bloqueando mutações incompatíveis.
5. **QualityGate & ReconciliationEngine**: Avaliação estatística de perda, completude geográfica de coordenadas e checagem cruzada entre microdados de BOs e indicadores consolidados.

---

## 2. Comandos Operacionais

### 2.1 Verificação de Saúde e Diagnóstico
- **Liveness**: `GET /api/health/live`
- **Readiness**: `GET /api/health/ready`
- **Database Engine**: `GET /api/health/database`
- **Ingestion Status**: `GET /api/health/ingestion`
- **Providers Cadastrados**: `GET /api/health/providers`
- **Métricas Consolidadas**: `GET /api/health/metrics`

### 2.2 Reprocessamento de Job
Para reprocessar um job que falhou sem duplicar registros ou comprometer o RAW histórico:
```bash
npx tsx scripts/reprocess_job.ts <jobId>
```

---

## 3. Matriz de Tratamento de Falhas

| Falha Detectada | Categoria do Erro | Ação Operacional |
| :--- | :--- | :--- |
| **HTTP 200 com HTML de erro** | `content_validation_error` | Download rejeitado; Job marcado como `failed`; RAW preservado. |
| **Timeout de Conexão** | `network_error` | Retry com backoff exponencial; até 3 tentativas. |
| **Coluna Obrigatória Ausente** | `schema_validation_error` | Parsing bloqueado pelo `SchemaValidator`; alerta de mudança de layout emitido. |
| **Worker Interrompido / Stale** | `stale_job_error` | Job detectado após 15 min sem heartbeat; transicionado para `stale` e requeued. |
| **Divergência de Reconciliação > 5%** | `reconciliation_error` | Quality gate emite status `failed` na reconciliação; publicação suspensa para auditoria. |
