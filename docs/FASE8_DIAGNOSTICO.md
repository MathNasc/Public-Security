# Diagnóstico de Infraestrutura e Operação (Fase 8)

## 1. Aplicação e API
- **Health Checks**: Apenas um `/api/health` estático existe. Faltam probes reais de Liveness e Readiness, verificando a conexão com PostgreSQL e PostGIS.
- **Rate Limiting**: Dependência `express-rate-limit` instalada mas não observamos aplicação estrita nas rotas abertas (especialmente Geocoding e Analysis, que são vulneráveis a abuso).
- **Correlation ID**: Ausente. Logs soltos não permitem rastrear a execução de uma Request até o Banco de Dados.
- **Logs Estruturados**: Aplicação utiliza `console.log` e `console.error` em formato de texto livre. Sem logs em formato JSON.

## 2. Segurança
- **Admin Endpoints**: Rotas `/api/admin/*` estão públicas! Precisam ser protegidas urgentemente com autenticação baseada em chaves de serviço ou JWT.
- **Secrets**: Faltam controles claros e `.env.example` documentando as variáveis.
- **Proteção Básica**: Faltam headers de segurança (`helmet`).

## 3. Banco de Dados e PostGIS
- **Conexões**: Drizzle ORM gerencia conexões, mas não há monitoramento do pool ou exportação de métricas para entender a carga real.
- **Análise Espacial (Queries Lentas)**: O raio da consulta `/api/analysis` pode ser manipulado por um cliente malicioso (ex. `radius=1000000`) forçando full scans sobre a tabela inteira do Brasil. Limites não estão sendo sanitizados fortemente no nível do PostGIS.

## 4. Ingestion e Scheduler
- O `JobManager` e `Worker.ts` implementam um sistema robusto baseado em `FOR UPDATE SKIP LOCKED` com checkpoint, timeout de 30min e Retries, o que é um excelente alicerce de Confiabilidade.
- **Dead Letter**: Jobs que ultrapassam `MAX_ATTEMPTS` vão para `FAILED`, o que funciona bem.
- Faltam Alertas/Métricas e Freshness Monitoring. Quando um Dataset fica semanas sem atualização, o sistema não avisa, apenas fica obsoleto passivamente.

## 5. Próximos Passos (Plano de Ação)
1. Integrar Middleware de Correlation ID e Logs Estruturados.
2. Criar rotas `/health/liveness` e `/health/readiness`.
3. Aplicar Rate Limit e limites rígidos de raio de busca no backend (Max 5km, por exemplo).
4. Proteger as rotas Admin.
5. Produzir arquivos `.env.example` e documentar arquitetura em `ARCHITECTURE.md` com `RUNBOOKS`.
