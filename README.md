# Public Security

Plataforma de inteligência e dados de segurança pública. Um ecossistema de análise georreferenciada e estatísticas de segurança utilizando bases governamentais abertas (IBGE, SSP, SINESP).

## Visão Geral

O Public Security consolida informações criminais fragmentadas do Brasil inteiro em um Dashboard moderno e oferece uma API Pública de consulta. O sistema possui geocodificação inteligente, extração assíncrona de boletins de ocorrência e processamento massivo via SQL.

## Arquitetura (Full-Stack)

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Lucide Icons. (Design Responsivo e Dark-Mode Native).
- **Backend (Serverless Ready)**: Express.js nativo suportado via Vercel Serverless Functions (`api/index.ts`).
- **Banco de Dados**: PostgreSQL na nuvem (via Supabase), modelado com Drizzle ORM. As consultas utilizam agregações SQL nativas de alto desempenho.
- **Geocodificação Inteligente**: Hub hibrido que converte Endereços em Coordenadas via Nominatim e reconhece CEPs via cruza com a API ViaCEP.
- **Orquestrador (JobWorker)**: Subsistema voltado para ETL (Extract, Transform, Load) dos dados massivos dos ministérios públicos e governos.

## Configuração do Ambiente

1. **Variáveis de Ambiente**:
Copie o arquivo de exemplo:
```bash
cp .env.example .env
```
Preencha a variável `DATABASE_URL` (com a string do PostgreSQL) e `ADMIN_SECRET` (para acesso administrativo).

2. **Instalação e Migração**:
```bash
npm install
npx drizzle-kit push
```

3. **Iniciando o Servidor de Desenvolvimento**:
```bash
npm run dev
```
O servidor backend e o Vite (proxy/assets) vão subir simultaneamente na porta 3000.

## Estrutura do Projeto

- `/src/pages`: Telas React (Dashboard Nacional, Home, Resultados, Admin, ApiDocs).
- `/src/components`: UI escalável (Searchbar, Mapas, Cards).
- `/src/api`: Rotas isoladas para a API Pública.
- `/src/db`: Schema Drizzle e gerenciamento de Pool (Serverless friendly com `idle_timeout`).
- `/src/ingestion`: Lógica de extração e padronização (Taxonomia) dos CSVs de governo.
- `/server.ts`: O coração do Express contendo os roteamentos de Middleware e limites de segurança (Rate Limiters).

## API Pública 

O repositório fornece uma API de acesso aberto (V1) que respeita regras de anonimização (LGPD) e oferece informações brutas e indicadores.
Para mais informações sobre documentação de acesso, parâmetros (como `lat`, `lon` e `radius`) e cabeçalhos (`X-API-Key`), inicie o projeto e acesse a tela `/api-docs`.

## Deploy (Produção)

Este repositório já está configurado com `vercel.json` para ser hospedado diretamente pela Vercel em modo Serverless. 

1. Suba este repositório para o GitHub.
2. Importe-o na Vercel (Framework Preset: Vite).
3. Adicione a sua `DATABASE_URL` e `ADMIN_SECRET` no painel.
4. Faça o deploy.

---
**Public Security &copy; 2026** - Código Aberto e Dados Governamentais.
