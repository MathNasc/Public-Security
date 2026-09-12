# Inventário de Legado e Duplicidade (Plano de Limpeza)

## 1. Endpoints Antigos e Depreciados
- **`/api/admin/run-engine/ssp` e `/api/admin/run-engine/sinesp`**
  - **Classificação:** REMOVER IMEDIATAMENTE
  - **Arquivo:** `server.ts`
  - **Símbolo:** Rotas POST
  - **Referências/Quem chama:** Ninguém (não existem chamadas no frontend).
  - **Substituto:** O novo fluxo com `JobManager`.
  - **Risco:** Muito Baixo.
  - **Ação Exata:** Apagar os blocos de código da rota.
  - **Como validar:** Chamar os endpoints via cURL e garantir que retornam 404.

- **`/api/admin/ingest`**
  - **Classificação:** REMOVER IMEDIATAMENTE
  - **Arquivo:** `server.ts`
  - **Símbolo:** Rota POST
  - **Referências/Quem chama:** Ninguém no Front. Era usado para injeção via cURL direto ao serviço antigo.
  - **Substituto:** `/api/admin/upload-ssp` + `Worker.ts`.
  - **Risco:** Baixo.
  - **Ação Exata:** Apagar a rota.

- **`/api/admin/download-sample`**
  - **Classificação:** REMOVER IMEDIATAMENTE
  - **Arquivo:** `server.ts`
  - **Símbolo:** Rota POST
  - **Referências/Quem chama:** Ninguém no Front (nenhum botão aciona).
  - **Substituto:** Nenhum necessário.
  - **Risco:** Baixo (Atualmente o script faz download de URL 404 e usa a pipeline de ingestão legada `src/ingestion/ssp/importer.ts`).
  - **Ação Exata:** Apagar a rota inteira.

- **`/api/admin/force-db-sync`**
  - **Classificação:** REMOVER IMEDIATAMENTE
  - **Arquivo:** `server.ts`
  - **Símbolo:** Rota POST `force-db-sync`
  - **Referências/Quem chama:** `Admin.tsx` (`handleForceSync` / `forceDbSync`).
  - **Substituto:** Scripts de Deploy (`drizzle-kit push`) ou inicialização controlada.
  - **Risco:** Alto (manter o código atual permite injetar comandos de terminal em produção com `child_process.exec`). A remoção afeta um botão no admin, que também deve ser removido.
  - **Pré-condição:** Remover o botão correspondente do Frontend.
  - **Ação Exata:** Apagar a rota no backend e apagar o botão `forceDbSync` no frontend.

## 2. Serviços Duplicados e Classes Antigas
- **`src/services/DataIngestionService.ts`**
  - **Classificação:** REMOVER IMEDIATAMENTE
  - **Arquivo:** `src/services/DataIngestionService.ts`
  - **Símbolo:** Classe inteira
  - **Referências:** `/api/admin/ingest` e `src/ingestion/ssp/importer.ts`.
  - **Substituto:** Arquitetura `Worker.ts`.
  - **Risco:** Baixo.
  - **Pré-condição:** Remover as rotas `/api/admin/ingest` e `/api/admin/download-sample` que dependem disso.
  - **Ação Exata:** Deletar arquivo.

- **Diretório `src/ingestion/ssp/`** (`downloader.ts`, `importer.ts`, `normalizer.ts`, `parser.ts`)
  - **Classificação:** REMOVER IMEDIATAMENTE
  - **Arquivo:** `src/ingestion/ssp/*`
  - **Referências:** Apenas a rota `/api/admin/download-sample`.
  - **Substituto:** `Worker.ts` + `SspSpAdapter.ts`.
  - **Risco:** Baixo.
  - **Ação Exata:** Deletar o diretório inteiro.

- **`src/ingestion/orchestration/JobWorker.ts`**
  - **Classificação:** DUPLICADO / MIGRAR ANTES DE REMOVER
  - **Arquivo:** `JobWorker.ts`
  - **Referências:** `Scheduler.ts` chama `JobWorker.poke()`.
  - **Substituto:** `Worker.ts`.
  - **Risco:** Médio. Esse Worker falsifica a execução de ingestões usando a nova tabela `ingestion_jobs`.
  - **Pré-condição:** Migrar as atualizações de status de Job de `JobWorker` para `Worker.ts`.
  - **Ação Exata:** Remover o `JobWorker.ts` e refatorar `Scheduler` para não invocar mocks.

- **`src/ingestion/core/types.ts`**
  - **Classificação:** REMOVER IMEDIATAMENTE
  - **Arquivo:** `src/ingestion/core/types.ts`
  - **Referências:** Nenhuma (Nenhum arquivo importa esses tipos).
  - **Substituto:** Nenhum.
  - **Risco:** Nenhum (Zero).
  - **Ação Exata:** Deletar arquivo.

## 3. Fluxos Paralelos e Tabelas
- **Tabela `data_imports` vs `ingestion_jobs`**
  - **Classificação:** MIGRAR ANTES DE REMOVER
  - **Referências:** `JobManager.ts` e `Worker.ts` usam `data_imports`. `Scheduler.ts` e `JobWorker.ts` usam `ingestion_jobs`.
  - **Risco:** Alto (O coração da aplicação depende disso).
  - **Pré-condição:** Atualizar `JobManager.createJob` e as lógicas de claim em `Worker.ts` para manipularem a tabela correta (`ingestion_jobs`), então apagar `data_imports` do schema.

## 4. Tabela Final de Remoções

| Item | Tipo | Usado? | Substituto | Ação | Risco |
| --- | --- | --- | --- | --- | --- |
| `/api/admin/run-engine/...` | Rota | Não | `JobManager` | REMOVER IMEDIATAMENTE | Baixo |
| `/api/admin/ingest` | Rota | Não | `upload-ssp` | REMOVER IMEDIATAMENTE | Baixo |
| `/api/admin/download-sample`| Rota | Não | Nenhum | REMOVER IMEDIATAMENTE | Baixo |
| `/api/admin/force-db-sync` | Rota | Sim (No Admin)| ORM/Deploy | MIGRAR ANTES DE REMOVER | Médio |
| `DataIngestionService.ts` | Serviço | Apenas Legacy | `Worker.ts` | REMOVER IMEDIATAMENTE | Baixo |
| Pasta `src/ingestion/ssp/` | Adapters Legacy| Apenas Legacy | `Worker` + Adapters | REMOVER IMEDIATAMENTE | Baixo |
| `src/ingestion/core/types.ts` | Tipagens | Não | N/A | REMOVER IMEDIATAMENTE | Zero |
| `JobWorker.ts` | Worker Mock | Sim (Scheduler)| `Worker.ts` | MIGRAR ANTES DE REMOVER | Médio |
| Tabela `data_imports` | Tabela | Sim (Worker) | `ingestion_jobs`| MIGRAR ANTES DE REMOVER | Alto |

## 5. Ordem Recomendada de Remoção (Do Menor Risco ao Maior)

1. **Risco Zero:** Deletar o arquivo órfão `src/ingestion/core/types.ts`.
2. **Risco Muito Baixo:** Apagar as rotas inúteis `/api/admin/run-engine/ssp` e `/api/admin/run-engine/sinesp`.
3. **Risco Baixo:** Remover `/api/admin/ingest` e `/api/admin/download-sample`.
4. **Risco Baixo:** Deletar em cascata o arquivo `DataIngestionService.ts` e toda a pasta `src/ingestion/ssp/` (pois agora nada os referencia).
5. **Risco Médio:** Apagar o botão "Forçar Sync do DB" (`forceDbSync`) no `Admin.tsx` e a rota `/api/admin/force-db-sync`.
6. **Risco Médio-Alto (Migração de Tabelas):** Refatorar `JobManager.ts` e `Worker.ts` para pararem de gravar em `data_imports` e passarem a gravar/ler da tabela `ingestion_jobs`.
7. **Risco Alto:** Apagar a classe `JobWorker.ts`, removendo a chamada paralela dela em `Scheduler.ts`, unificando tudo no verdadeiro `Worker.ts`. Finalmente apagar a definição de tabela `data_imports` do `schema.ts`.
