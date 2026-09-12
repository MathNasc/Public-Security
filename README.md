# Public Security Platform

Plataforma de inteligência, transparência e análise georreferenciada de dados de segurança pública baseada em fontes governamentais abertas oficiais (SSP-SP, SINESP e secretarias estaduais).

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
  ├── GeoNormalizationService (IBGE Modulo 10, Bounds Brasil, Topônimos)
  ├── SummaryService (Google Gemini AI com Fallback Determinístico Offline)
  └── PipelineAutomationService & IngestionWorker (ETL, Quality Gate, RAW Storage)
                            │
               Drizzle ORM (Type-Safe SQL)
                            ▼
[ Camada de Persistência: PostgreSQL na Nuvem (com Fallback Local SQLite/LibSQL) ]
```

---

## 2. Fontes de Dados e Cobertura

- **SSP-SP (Secretaria de Segurança Pública de São Paulo)**:
  - Microdados de Boletins de Ocorrência (BO) com coordenadas geográficas pontuais (latitude/longitude), endereço e delegacia de circunscrição.
  - Séries estatísticas mensais municipais consolidadas (formatos horizontal e vertical).
  - Fonte primária oficial totalmente validada com ciclo de automação ponta a ponta.
- **SINESP (Sistema Nacional de Estatísticas de Segurança Pública)**:
  - Séries estatísticas municipais consolidadas em âmbito federal (Ministério da Justiça e Segurança Pública).
  - Utilizada como base nacional e cobertura agregada para os 26 estados e DF.
- **IBGE (Instituto Brasileiro de Geografia e Estatística)**:
  - Base canônica de códigos de municípios (7 dígitos com dígito verificador módulo 10) e limites territoriais.

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
- **Índice de Confiança (%)**: Avalia a densidade, completude espacial e recência dos dados oficiais disponíveis (e não o nível de perigo).
- **Transparência de Granularidade**: Quando microdados pontuais não existem para o raio, a plataforma utiliza agregação municipal ou estadual com nota explícita de transparência (`fallback.disclosure`).

---

## 4. Pipeline de Ingestão e Automação

O pipeline de dados opera em 20 etapas rigorosas:
1. **Verificação de Atualização**: Checagem de novas publicações periódicas.
2. **Armazenamento RAW Imutável**: Os arquivos recebidos são salvos intactos com hash SHA-256 e contagem de bytes.
3. **Quality Gate**: Validação estrutural de cabeçalhos e tipos antes de qualquer escrita no banco.
4. **Ingestion Worker em Stream**: Processamento por lotes de 1.000 registros para alta eficiência de memória.
5. **Deduplicação Determinística**: Geração de hash SHA-256 por ocorrência, impedindo duplicações.
6. **Idempotência**: Reprocessamento de um mesmo arquivo não altera os totais consolidados.
7. **Recuperação de Jobs Presos**: Liberação automática de locks expirados após timeout operacional.
8. **Invalidação de Cache**: Limpeza automática de caches analíticos após novas publicações.

---

## 5. Observabilidade e Métricas

A plataforma expõe métricas e rastreamento em tempo real:
- **`x-request-id`**: Identificador único UUID por requisição HTTP, propagado em logs estruturados.
- **Métricas de Latência**: Cálculo contínuo de percentis **p50, p95 e p99** de resposta da API.
- **Endpoint `/api/metrics`**: Exposição de métricas de tráfego, erros, latência e status dos workers.
- **10 Métricas Operacionais de Ingestão**: Última tentativa, último sucesso, última falha, duração, registros lidos/válidos/inseridos, taxa de inválidos, duplicidades, contagem de retries, status do job e diagnóstico de atraso da fonte.

---

## 6. Endpoints da API

### Públicos
- `GET /api/analysis?lat=-23.5505&lon=-46.6333&radius=1000&period=12m`
  - Retorna o Score de Segurança, confiança, distribuição por categorias, dados ausentes, fontes oficiais, notas de transparência e sumário explicativo.
- `GET /api/sources`
  - Lista as fontes integradas, status operacional e última data de sincronização.
- `GET /api/health`
  - Diagnóstico de saúde do backend e conectividade com a camada de dados.
- `GET /api/metrics`
  - Resumo de métricas operacionais e latência (p50/p95).

### Administrativos (Requer cabeçalho `Authorization: Bearer <ADMIN_SECRET>` ou `x-admin-token`)
- `GET /api/admin/pipeline/status?sourceId=SSP-SP`
  - Relatório detalhado das 10 métricas operacionais e histórico de jobs.
- `POST /api/admin/pipeline/trigger`
  - Disparo manual de ciclo de automação e ingestão.
- `POST /api/admin/pipeline/reprocess/:jobId`
  - Reprocessamento idempotente de lote a partir do arquivo RAW.
- `POST /api/admin/pipeline/recover-stuck`
  - Varredura e recuperação de jobs em timeout.

---

## 7. Execução Local

### Pré-requisitos
- Node.js 18+ (Node 20+ recomendado)
- npm 9+

### Passos
1. **Configurar variáveis de ambiente**:
   ```bash
   cp .env.example .env
   ```
   *(Preencha `DATABASE_URL`, `ADMIN_SECRET` e opcionalmente `GEMINI_API_KEY`)*

2. **Instalar dependências**:
   ```bash
   npm install
   ```

3. **Executar em desenvolvimento**:
   ```bash
   npm run dev
   ```
   O servidor Express e a interface Vite estarão acessíveis na porta `3000` (`http://localhost:3000`).

---

## 8. Execução de Testes e Suíte de Confiabilidade

Para executar a suíte completa de auditoria de confiabilidade com validação dos 18 tópicos:
```bash
npm test
```

Para executar todas as suítes (Confiabilidade, Qualidade de Dados Geográficos e Automação de Pipeline):
```bash
npm run test:all
```

---

## 9. Limitações Conhecidas dos Dados

- **Defasagem Temporal**: A SSP-SP publica dados consolidados com defasagem oficial de aproximadamente 25 dias úteis do mês subsequente.
- **Geocodificação**: Microdados de BO contêm coordenadas pontuais georreferenciadas pela polícia; tabelas agregadas municipais não contêm coordenadas de rua e utilizam o centroide do município.
- **Subnotificação**: Crimes de menor potencial ofensivo (como furtos simples) possuem taxa de registro menor que crimes violentos.

---

## 10. Troubleshooting

- **Banco de dados offline**: Se o PostgreSQL não estiver acessível, o sistema ativa automaticamente o fallback local SQLite/LibSQL (`data/local_radar.db`), garantindo continuidade de operação e testes locais.
- **Erro de autorização administrativa**: Verifique se a variável `ADMIN_SECRET` está preenchida no `.env` e envie o cabeçalho `x-admin-token: <ADMIN_SECRET>`.
- **Job travado em PROCESSING**: O sistema detecta e libera jobs presos automaticamente no próximo ciclo ou via `POST /api/admin/pipeline/recover-stuck`.
- **Falha de cota de IA**: Em caso de limite da API Gemini (HTTP 429/503), o `SummaryService` ativa automaticamente o gerador de resumos determinísticos offline.

---
**Public Security &copy; 2026** — Transparência e Integridade em Dados Públicos.
