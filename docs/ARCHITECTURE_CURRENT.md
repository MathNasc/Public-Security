# Arquitetura Atual Consolidada

## Resumo Arquitetural
O sistema **Public Security** é um Monolito Full-Stack híbrido escrito em TypeScript/Node.js, onde um servidor Express nativo hospeda tanto as rotas de API do backend quanto o frontend React compilado pelo Vite.

## Camadas

1. **Frontend (SPA - Single Page Application)**
   - **Stack**: React 19, Vite, TailwindCSS, Lucide-React.
   - **Comportamento**: É empacotado para a pasta `/dist`. Em produção, o servidor Express atua como servidor estático provendo o `index.html` via Fallback (`*all`).
   - **Comunicação**: O Frontend chama APIs REST internas no `/api/*`. Não há chamadas a bancos diretamente do cliente.

2. **Backend (API + Worker Híbrido)**
   - **Stack**: Express 5, Node.js (`esbuild` no build).
   - **Design Pattern**: Monolito. Roteadores (`app.use('/api')`), Controladores (nas próprias rotas), e Serviços Injetáveis (`SafetyAnalysisService.ts`).
   - **Jobs / Fila**: Processamento ocorre no *mesmo* container da API através de invocação de promises ou cron internos (`JobWorker.poke()`). 
   - **Riscos em Scale-Out (Cluster)**: Se subir 5 instâncias deste container, haverá "race condition" (concorrência) de Workers tentando ler o mesmo job, pois não há Lock de Linha robusto no Postgres atualmente utilizado (`FOR UPDATE SKIP LOCKED` precisa ser validado no Drizzle). Além do mais, em Cloud Run, processamento em background (após o response) pode sofrer throttling da CPU.

3. **Banco de Dados (PostgreSQL + PostGIS)**
   - **Stack**: Supabase PostgreSQL / Drizzle ORM.
   - O núcleo do sistema baseia-se em delegação de cálculos para o banco. O PostGIS gerencia índices GiST e ST_DWithin para achar crimes em um raio espacial (`radiusMeters`).
   - **Storage Físico**: Arquivos RAW são salvos em disco local (`/raw_storage`). *Isso é um problema sério em containers Stateless*.

## Maiores Riscos Estruturais (Atenção Máxima)
1. **Armazenamento de Arquivos no Disco (`/raw_storage`)**: Servidores modernos de VPS Docker ou Cloud Run são efêmeros. Salvar CSVs localmente significa perder os arquivos a cada restart ou escalonamento. A migração para S3 ou Google Cloud Storage é mandatória para produção real.
2. **Workers em Processo Único**: A arquitetura mistura o Servidor Web e o Worker de Ingestão Pesada no mesmo Node. Um processamento massivo de CSV com 10 milhões de linhas pode travar o Event Loop do Node e causar 502 Bad Gateway na API para os usuários. A arquitetura ideal separaria a execução do Worker num segundo serviço (ou usando Message Queues reais tipo SQS/RabbitMQ).
3. **Duplicidade Lógica de Ingestão**: Coexistem `JobWorker`, `Worker` e antigas classes `IngestionEngine` e `DataIngestionService`. Resolver essa fragmentação é o foco número 1 da padronização de backend.
