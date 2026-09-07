# RUNBOOK: Database Issues

## Cenários e Resoluções

### 1. Conexão Recusada ou Timeout (PostgreSQL)
- **O que aconteceu?** A API está retornando erros `503` ou logs apontam `ECONNREFUSED` no health check de Liveness.
- **Como confirmar?** Verifique a métrica `event: db_connection_error` nos logs estruturados, ou acesse a rota `/health/readiness`.
- **Como mitigar?** Verificar se o Container do Postgres (ex: Cloud SQL, RDS, ou local) atingiu limites de conexões abertas (`max_connections`).
- **Como recuperar?** No provedor do banco de dados, encerre processos travados. Se for falha de rede temporária, a aplicação deve se recuperar sozinha graças ao Pooling do `postgres.js`.
- **Como evitar recorrência?** Ativar PgBouncer para connection pooling se o tráfego escalar além da capacidade natural.

### 2. Sobrecarga em Consultas Espaciais (PostGIS)
- **O que aconteceu?** APIs lentas (latency > 5000ms), alertas de Slow Query no log.
- **Como confirmar?** Filtrar no log por rotas `/api/analysis` que estouram os limites. 
- **Como mitigar?** O sistema agora corta o raio artificialmente para `50km` na API para barrar abusos. Se mesmo assim a CPU do banco esgotar, desativar temporariamente as rotas públicas de consulta ou ativar caching forçado (ex: Redis) via variável de ambiente, se implementado no futuro.
- **Como recuperar?** Reiniciar o banco se a fila de deadlocks persistir.
- **Como evitar recorrência?** Monitorar uso dos índices `GIST` periodicamente executando `EXPLAIN ANALYZE`.
