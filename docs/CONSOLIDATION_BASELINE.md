# Consolidação Técnica - Baseline

**Data da Auditoria**: 2026-09-11
**Branch Analisada**: `main` (Ambiente Local/Container)

## 1. Stack Real Utilizado
- **Frontend**: React 19, Vite 6, TailwindCSS 4, Recharts, React-Leaflet, Lucide-React.
- **Backend**: Express 5.2.1, Node.js (`tsx` para runtime).
- **Banco de Dados**: PostgreSQL (via Supabase ou auto-hospedado) + Drizzle ORM.
- **Arquitetura de Deploy Real**: Monolito (Vite Middleware integrado ao Express) projetado para processos de longa duração em Containers (VPS, Cloud Run, EC2). 
  - *Nota*: A documentação anterior citava "Vercel Serverless", o que é incompatível com o design arquitetural atual (uso contínuo do `IngestionWorker`, banco de dados com polling longo, e `child_process`).

## 2. Comandos Válidos

| Comando | Script | Funciona? |
| --- | --- | --- |
| **Desenvolvimento** | `npm run dev` | **SIM** |
| **Build** | `npm run build` | **SIM** (Finaliza compilado para `dist/server.cjs`) |
| **Produção** | `npm run start` | **SIM** |
| **Lint / Typecheck**| `npm run lint` | **NÃO** (Falha com 14 erros de TypeScript) |
| **Migrações (Gen)** | `npm run db:generate` | **SIM** (Drizzle-kit funcionando) |
| **Migrações (Push)**| `npm run db:push` | **SIM** |
| **Seed** | `npm run db:seed` | **FALHA** (Arquivo `src/db/seed.ts` não existe) |

## 3. Resultado das Verificações e Erros Encontrados

O comando de build é bem-sucedido porque Vite/esbuild ignoram o Typecheck por padrão, porém o `npm run lint` evidenciou problemas severos que podem causar quebras em tempo de execução:

1. **`src/ingestion/orchestration/JobWorker.ts` (135, 166, 173)**
   - Falta tipagem genérica em Promises (`Expected 1 arguments, but got 0`).
   - *Risco Alto*: Incompatibilidade de overload no `db.insert`. Estão faltando as propriedades `createdAt` e `updatedAt` nos objetos sendo gravados.
2. **`src/ingestion/pipeline/Worker.ts` (7-40)**
   - `TS2300`: Identificadores duplicados. Múltiplos imports repetidos para as classes dos Adapters (`IspRjAdapter`, `SspMgAdapter`, etc.).
3. **`src/pages/Admin.tsx` (121)**
   - `TS2304`: Cannot find name `showToast`. Provável resquício de exclusão de componente não limpo, causando quebra no Frontend caso acionado.
4. **`src/pages/Result.tsx` (330-331)**
   - `TS2339`: `import.meta.env` gerando erro. Falta declaração do Vite no ambiente do TypeScript.
5. **`src/services/SafetyAnalysisService.ts` (42, 43, 154, 177, 212)**
   - Uso de propriedades inexistentes na interface (`request.location`).
   - Comparações estritas incompatíveis (tentando checar se algo é `"municipality"` quando o compilador acha que o escopo limita-se a `"coordinate"`).

## 4. Problemas Bloqueadores e Riscos Técnicos Imediatos

### Bloqueadores Funcionais (Risco de Runtime Crash)
- **Insert Drizzle Incompleto (`JobWorker.ts`)**: Se os campos `createdAt` e `updatedAt` não possuem cláusula `.defaultNow()` no banco ou não são passados no código, a inserção irá disparar exceção no SQL de produção.
- **Reference Error no Frontend (`Admin.tsx`)**: O uso da função fantasma `showToast` bloqueará o painel de administração em cenários de erro/sucesso (ReferenceError).
- **Caos Arquitetural na Ingestão (Duplicidade Crítica)**: Existem serviços legados rodando em paralelo aos serviços novos. O sistema possui `DataIngestionService.ts`, `IngestionEngine.ts`, `JobManager.ts`, `JobWorker.ts` e `Worker.ts`. Isso fragmenta responsabilidades e torna impossível saber onde aplicar correções.

### Problemas Não Bloqueadores (Manutenibilidade)
- **Script Fantasma no package.json**: `db:seed` chama um arquivo deletado, causando confusão em deploy pipelines.
- **Tipagens soltas (`import.meta.env`)**: Sujam os logs de CI/CD.

## 5. Próximos Passos Recomendados (Ações Pós-Auditoria)

**Não avançar para construção de Scrapers sem antes executar:**
1. **Limpeza Arquitetural**: Eleger APENAS UMA engine de ingestão (preferencialmente a baseada em Jobs - `JobManager` / `Worker`). Deletar arquivos obsoletos (ex: `DataIngestionService.ts` e `IngestionEngine.ts`).
2. **Correção Drizzle**: Auditar as cláusulas `.defaultNow()` nas tabelas do `schema.ts` e corrigir as inserções do `JobWorker.ts`.
3. **Correção de Frontend**: Substituir os chamados `showToast` ausentes no `Admin.tsx` ou injetar o hook de UI correspondente.
4. **Remoção de Código Morto em Typechecks**: Corrigir imports duplicados em `Worker.ts` e corrigir lógicas mal formadas no `SafetyAnalysisService.ts`.
5. **Atualizar `package.json`**: Remover comandos obsoletos (`db:seed`).
