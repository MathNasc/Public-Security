# Registro de Remoção de Legado (LEGACY REMOVAL LOG)

Este documento registra a execução metódica e cirúrgica da limpeza de código morto, rotas obsoletas e serviços duplicados mapeados em `docs/LEGACY_INVENTORY.md`.

---

## Ciclo 1: Código Morto, Endpoints Deprecados e Serviços Duplicados (Menor Risco)

### 1. Tipagem Órfã e Desconectada
- **Item removido:** `src/ingestion/core/types.ts`
- **Motivo:** Interface declarada no início do projeto que não era consumida por nenhum arquivo ou módulo em todo o repositório.
- **Arquivos:** `src/ingestion/core/types.ts` (deletado).
- **Substituto:** Interfaces reais em `src/ingestion/adapters/BaseAdapter.ts`.
- **Validação:** Verificado via grep de imports e compilador TypeScript (`tsc --noEmit`).
- **Possíveis riscos:** Nenhum.

### 2. Endpoints Depreciados e Rotas Retornando Apenas Mensagem de Migração
- **Item removido:**
  - `POST /api/admin/run-engine/ibge`
  - `POST /api/admin/run-engine/ssp` (apenas retornava aviso para usar JobManager)
  - `POST /api/admin/run-engine/sinesp` (apenas retornava aviso para usar JobManager)
  - `POST /api/admin/ingest` (injeção direta em serviço legado)
- **Motivo:** Rotas obsoletas não acionadas pelo frontend ou que apenas instruíam migração.
- **Arquivos:** `server.ts`
- **Substituto:** `JobManager.ts` e pipeline de ingestão desacoplada.
- **Validação:** Verificação de rotas no frontend e `npm run build`.
- **Possíveis riscos:** Nenhuma chamada ativa no frontend.

### 3. Rota de Download de Exemplo Antigo e Vulnerabilidade de Shell Sync
- **Item removido:**
  - `POST /api/admin/download-sample`
  - `POST /api/admin/force-db-sync`
  - Botão `forceDbSync` ("Forçar Sincronização do Banco") no frontend `src/pages/Admin.tsx`
- **Motivo:**
  - `download-sample` baixava um CSV fixo de 2019 de repositório de terceiros para alimentar um serviço legado extinto.
  - `force-db-sync` executava `child_process.exec("npm run db:migrate:prod")` via requisição web, representando grave risco de execução arbitrária no container.
- **Arquivos:** `server.ts`, `src/pages/Admin.tsx`.
- **Substituto:** Migrações seguras via scripts de inicialização controlados (`drizzle-kit push` / deploy).
- **Validação:** Frontend sem erros de renderização, linter e build 100% íntegros.
- **Possíveis riscos:** Remoção do botão de teste na UI de administração.

### 4. Serviços e Parsers Duplicados / Mortos
- **Item removido:**
  - `src/services/DataIngestionService.ts`
  - Diretório `src/ingestion/ssp/` (`downloader.ts`, `importer.ts`, `normalizer.ts`, `parser.ts`)
  - Script obsoleto de teste: `scripts/seed-sample.ts`
- **Motivo:** Eram os consumidores legados que rodavam síncronos fora da esteira de filas (`Worker.ts` / `SspSpAdapter.ts`). Estavam acoplados unicamente à rota `download-sample` e `ingest`.
- **Arquivos:**
  - `src/services/DataIngestionService.ts` (deletado)
  - `src/ingestion/ssp/` (deletado)
  - `scripts/seed-sample.ts` (deletado)
- **Substituto:** `SspSpAdapter.ts` + `Worker.ts`.
- **Validação:** `tsc --noEmit` (lint) passou com zero erros; `vite build` e `esbuild` passaram com sucesso.
- **Possíveis riscos:** Nenhum remanescente.

---

## Status da Compilação e Verificação (Ciclo 1)
- **TypeScript Typecheck (`npm run lint`):** PASSOU (0 erros)
- **Production Build (`npm run build`):** PASSOU (`dist/server.cjs` e `dist/index.html` gerados com sucesso)

---

## Ciclo 2: Desacoplamento do Orquestrador e Remoção do Worker Mock Duplicado

### 1. Worker Mock Duplicado e Simulado
- **Item removido:** `src/ingestion/orchestration/JobWorker.ts`
- **Motivo:** Era um worker simulado de protótipo que criava arquivos falsos em `/tmp/raw_...`, forçava uma chamada única de `SinespAdapter` para todos os estados sem suporte a granularidade, concorrendo com o worker real (`IngestionWorker`).
- **Arquivos:** `src/ingestion/orchestration/JobWorker.ts` (deletado), `src/ingestion/orchestration/Scheduler.ts` (removido import e chamada `JobWorker.poke()`).
- **Substituto:** O `IngestionWorker` autônomo e contínuo em `src/ingestion/pipeline/Worker.ts` (que consome todos os 27 adapters estaduais reais e normaliza ocorrências/indicadores no PostgreSQL/PostGIS).
- **Validação:** `tsc --noEmit` e `npm run build` aprovados.
- **Possíveis riscos:** Nenhum, pois o worker real é o processador ativo em produção.

---

## Ciclo 3: Schema SQLite Abandonado e Sanitização de Endpoints

### 1. Schema SQLite Morto e Incompatível
- **Item removido:** `src/db/schema_v2.ts`
- **Motivo:** Arquivo órfão com definições de tabelas para SQLite (`drizzle-orm/sqlite-core`), incompatível e não utilizado pela aplicação, que utiliza PostgreSQL oficial (`src/db/schema.ts`).
- **Arquivos:** `src/db/schema_v2.ts` (deletado).
- **Substituto:** `src/db/schema.ts` (PostgreSQL com PostGIS).
- **Validação:** Nenhuma referência no código fonte (`grep -rn "schema_v2"` com 0 ocorrências) e typecheck aprovado.
- **Possíveis riscos:** Nenhum.

### 2. Mock Fallback com Dados Hardcoded e Rota Stub Inútil
- **Item removido:**
  - Mock de dados falsos de 2026 em `GET /api/admin/ingestion/status`
  - Rota stub `POST /api/admin/ingestion/jobs/:id/retry`
- **Motivo:** O endpoint de status de ingestão retornava registros falsos de jobs caso o banco estivesse offline ou vazio. A rota de retry era um stub sem funcionalidade e sem consumidores no frontend.
- **Arquivos:** `server.ts`
- **Substituto:** Retorno de dados reais ou coleções vazias limpas (`{ jobs: [], datasets: [] }`).
- **Validação:** Typecheck e build completos.
- **Possíveis riscos:** Nenhum.

### 3. Remoção de Vazamento Temporário de Variáveis de Ambiente no Health Check
- **Item removido:** Linha de debug `fs.writeFileSync("/tmp/env.log", JSON.stringify(process.env))` na rota `GET /api/health`.
- **Motivo:** Risco grave de segurança que gravava segredos de ambiente no sistema de arquivos do container a cada requisição de health check.
- **Arquivos:** `server.ts`
- **Substituto:** Resposta simples `{ status: "ok" }`.
- **Validação:** Requisição de health check limpa e segura.
- **Possíveis riscos:** Nenhum.

### 4. Conexão do Botão Órfão de Discovery no Painel Admin
- **Item corrigido:** Rota `POST /api/admin/ingestion/discovery`.
- **Motivo:** O frontend `Admin.tsx` possuía o botão "Executar Discovery Nacional", mas a rota retornava 404 por não estar registrada no servidor.
- **Arquivos:** `server.ts`.
- **Substituto:** Endpoint integrado diretamente ao `globalScheduler.tick()`.
- **Validação:** Testado e compilado com sucesso.
- **Possíveis riscos:** Nenhum.

---

## Ciclo 4: Remoção de Engine Legada de IBGE, Diretórios Órfãos e Imports Não Utilizados

### 1. Engine Legada de Sincronização do IBGE
- **Item removido:** `src/ingestion/adapters/geographic/ibge/IbgeSyncService.ts` e diretórios `src/ingestion/adapters/geographic/` e `src/ingestion/adapters/ssp-sp/`.
- **Motivo:** A classe `IbgeSyncService` era acoplada exclusivamente à antiga rota extinta `/api/admin/run-engine/ibge`. O seeder oficial de dados espaciais e limites municipais do IBGE é o `scripts/seed-ibge.ts` (`npm run seed:ibge`). O diretório `ssp-sp` estava vazio.
- **Arquivos:** `src/ingestion/adapters/geographic/ibge/IbgeSyncService.ts` (deletado) e diretórios esvaziados removidos.
- **Substituto:** `scripts/seed-ibge.ts`.
- **Validação:** 0 referências encontradas via grep, typecheck passou com 0 erros.
- **Possíveis riscos:** Nenhum.

### 2. Limpeza de Imports Mortos e Ativação de Middlewares
- **Item removido:** Imports não utilizados em `server.ts` (`helmet`, `geographicStates`, `rawStorage` do schema, comentários residuais de adapters).
- **Item ativado:** Montagem do middleware `requestLogger` estruturado e montagem do roteador `healthRouter` em `/health`.
- **Arquivos:** `server.ts`.
- **Validação:** Linter (`npm run lint`) e build (`npm run build`) 100% verdes.
- **Possíveis riscos:** Nenhum.

---

## Status da Compilação e Verificação Geral
- **TypeScript Typecheck (`npm run lint`):** PASSOU (0 erros)
- **Production Build (`npm run build`):** PASSOU (`dist/server.cjs` e `dist/index.html` gerados com sucesso)

---

## Pendências Restantes
1. **Unificação da Tabela de Ingestão (`data_imports` vs `ingestion_jobs`):**
   - No momento oportuno, unificar os metadados de jobs em uma única tabela de esquema para evitar divergência entre discovery do orquestrador e batch worker.
