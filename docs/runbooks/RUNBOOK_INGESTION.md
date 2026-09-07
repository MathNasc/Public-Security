# RUNBOOK: Ingestion and Pipeline Issues

## Cenários e Resoluções

### 1. Worker Preso Processando Mesmo Job (Job Locking)
- **O que aconteceu?** Um arquivo CSV gigantesco causou OOM (Out Of Memory) no Worker, e o Worker morreu sem atualizar o status para `FAILED`.
- **Como confirmar?** O banco `data_imports` lista o job como `PROCESSING`, porém sem avanço de checkpoint nos últimos 30 minutos.
- **Como recuperar?** O Job Manager está programado para assumir orfandade após 30 minutos `locked_at < NOW() - INTERVAL '30 minutes'` usando `FOR UPDATE SKIP LOCKED`. Um worker novo irá resgatar a tarefa e processar do checkpoint onde ela parou. Nenhuma ação manual imediata é requerida.
- **Como evitar recorrência?** Se o arquivo for cronicamente problemático (formato quebrando o Node Stream), marcar como `CANCELLED` no banco ou isolar a linha do CSV na Raw Storage.

### 2. Atraso Crônico na Atualização (Freshness Failure)
- **O que aconteceu?** Usuários reportam falta de dados do mês recente, apesar das Secretarias de Segurança já terem publicado.
- **Como confirmar?** A tela (ou log) indica `Último sucesso: Data Antiga`.
- **Como mitigar?** Via painel de admin (ou POST na API autenticada `/api/admin/ingest`), forçar o recarregamento do Source.
- **Como evitar recorrência?** Monitorar ativamente o cron (scheduler externo) responsável por engatilhar a API Admin para ingestão nacional.
