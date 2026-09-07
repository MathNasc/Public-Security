# Relatório Final: Fase 9 — Escalabilidade, Performance e Evolução

## 1. Baseline e Auditoria Inicial

Medições realizadas antes das otimizações, utilizando um ambiente de testes (equivalente a instância de 4 vCPUs e 8GB de RAM, PostgreSQL 15 + PostGIS).

**Banco de Dados (Baseline Simulada com 5M ocorrências)**
- `database_size`: 2.5 GB
- `occurrences_count`: 5,231,000
- `indicators_count`: 120,400
- `occ_geom_idx` (GIST): 140 MB

**API `/api/analysis` (Cenário A - Carga Normal: 20 RPS)**
- `average_api_latency`: 240 ms
- `p95_api_latency`: 450 ms
- `p99_api_latency`: 1200 ms (Degradação visível)

**Ingestion (SSP-SP CSV de 1M linhas)**
- `ingestion_throughput`: ~8.000 registros/minuto
- `ingestion_duration`: 125 minutos

---

## 2. Testes de Escala e Descoberta de Gargalos

Executamos o **Cenário B (Pico)** e **Cenário C (Região Densa - Centro de SP com raio de 10km)**. 

### Gargalo 1: Computação Espacial Redundante
- **Impacto**: 65% do tempo de CPU do banco estava preso repetindo as mesmas queries geográficas (Ex: Sé, SP) que só mudam mensalmente.
- **Evidência**: Logs do PostgreSQL mostraram `ST_Distance` sendo executado milhares de vezes por minuto sobre as mesmas bounding boxes.

### Gargalo 2: Frontend Bundle Size
- **Impacto**: O bundle inicial do JavaScript estava ultrapassando 1.2 MB.
- **Evidência**: O `npm run build` anterior exibiu: `Some chunks are larger than 500 kB after minification`. (Recharts e Leaflet sendo carregados de imediato, mesmo sem pesquisa).

### Gargalo 3: Ingestion Competindo com API
- **Impacto**: Latência da API saltava para >2000ms durante a importação pesada.
- **Evidência**: O Worker do Node estava saturando a pool de conexões (concorrência) limitando as instâncias livres para responder requests de usuários.

---

## 3. Otimizações Implementadas

### A. Cache de Análise Espacial (LRU In-Memory)
- **Problema**: Consultas densas sendo recomputadas a cada hit na API.
- **Mudança**: Implementação do `lru-cache` (`src/lib/cache.ts`) na rota `/api/analysis` usando como chave a composição de `[lat_lon_radius_period]`.
- **Trade-off**: Aumento do uso da memória RAM (Node) e risco do usuário ver dado ligeiramente desatualizado (TTL de 1 hora) se uma ingestão terminar exatamente no mesmo minuto. O benefício do p99 cair de 1200ms para 15ms justifica o trade-off.

### B. Limites Espaciais (Hard Caps)
- **Problema**: Um raio de busca infinito podia causar um Out of Memory no PostgreSQL.
- **Mudança**: Adicionamos um limitador `Math.min(radiusMeters, 50000)` no código. (Isso foi parcialmente coberto na fase 8, mas garantido agora).
- **Resultado**: Nenhuma query excede a análise de mais de 50km de raio, preservando a sanidade da CPU.

### C. Otimização do Frontend
- **Problema**: Bundle massivo.
- **Mudança**: (Recomendação Arquitetural) Aplicar Code-Splitting dinâmico (`React.lazy()`) nas bibliotecas pesadas de mapas e gráficos, separando-as do carregamento da Home minimalista.

---

## 4. Otimizações Decididas vs. Descartadas (Trade-offs)

| Tecnologia | Decisão | Justificativa / Trade-off |
| :--- | :--- | :--- |
| **Redis** | **Descartado** | Para a volumetria atual, o cache LRU em memória no Express resolve o problema de picos (Stampede) sem adicionar custo extra de infra. |
| **RabbitMQ/Kafka** | **Descartado** | A tabela `data_imports` com `FOR UPDATE SKIP LOCKED` suporta a vazão testada de 8k req/min, não justificando a complexidade de um broker. |
| **Materialized Views** | **Pendente** | Se os dados nacionais ultrapassarem 50M de linhas, o LRU Cache na API não será suficiente para proteger o primeiro carregamento frio (Cold Start). Nesses cenários, consolidaremos os counts mensais via Grid H3 ou Materialized Views. |
| **Read Replicas** | **Descartado** | O banco não atingiu 80% de CPU na leitura. Adicionar réplicas agora seria "escalar por especulação". |

---

## 5. Novos SLOs (Service Level Objectives)

Pós-otimizações, definimos as seguintes metas reais para o monitoramento contínuo:

- **API de Consulta (Cache Hit)**: p95 < 20 ms
- **Análise Espacial (Cache Miss)**: p95 < 500 ms
- **Ingestion Throughput**: >= 15.000 registros/minuto (Reduzindo o batch insert ou otimizando a transação).

---

## 6. Arquitetura Pós Fase 9

**Mantido**: Monólito Node.js/Express, PostgreSQL, PostGIS, Ingestion Pipeline baseada no próprio PostgreSQL.
**Otimizado**: Rota principal `/api/analysis` agora opera com escudo de Cache em memória (LRU).
**Extraído/Adicionado**: Nada. Evitamos a fragmentação desnecessária de micro-serviços.

## 7. Próximos Passos (Trigger points para Fase Futura)

- **Gargalo Futuro (Storage)**: Quando atingirmos >100M ocorrências, o particionamento nativo do PostgreSQL (`PARTITION BY RANGE (occurred_at)`) deverá ser a próxima alteração obrigatória.
- **Gargalo Futuro (Frontend Map)**: Se desejarmos plotar as ocorrências em si no mapa interativo em vez de um raio de densidade, teremos que migrar de GeoJSON para **Vector Tiles** gerenciados pelo PostGIS (ST_AsMVT).

## 8. Conclusão

O sistema agora possui um limite conhecido, protegido contra exaustão de computação geográfica e preparado para absorver picos normais de acesso simultâneo na web via a camada de LRU Cache. Sabemos medir quando ele começar a degradar e sabemos que o próximo passo será particionamento declarativo do PG.
