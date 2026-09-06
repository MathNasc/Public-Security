# Vizinhança MVP

MVP de análise de segurança por região. Desenvolvido com uma arquitetura full-stack orientada a mapas e estatísticas locais.

## Arquitetura

- **Frontend**: React (Vite), Tailwind CSS, React Router, Lucide Icons, Recharts (gráficos), React-Leaflet (mapas).
- **Backend**: Express (Node.js) com TypeScript (tsx).
- **Banco de Dados**: SQLite (via `@libsql/client`) e Drizzle ORM. Preparado estruturalmente para migração direta ao PostgreSQL/Supabase.
- **Geocodificação**: Proxy local integrado ao Nominatim (OpenStreetMap).

## Variáveis de Ambiente Necessárias

O arquivo `.env.example` já cobre a maioria das necessidades, mas você pode definir localmente:

```env
DATABASE_URL="file:local.db"
USE_MOCK_DATA="true"
```

## Como Executar Localmente

O ambiente já está configurado no `package.json` para rodar tanto o servidor Express quanto o Vite na porta 3000.

1. **Instale as dependências**:
   ```bash
   npm install
   ```

2. **Gere e popule o banco de dados**:
   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

3. **Inicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```

O MVP estará rodando em `http://localhost:3000`.

## Instruções de Deploy (Vercel / Cloud Run)

Para deploy na Vercel (Frontend) e Supabase (Backend/DB):
1. Crie um projeto no Supabase e obtenha as strings de conexão PostgreSQL.
2. Troque o dialeto no `drizzle.config.ts` para `postgresql` e atualize os pacotes do drizzle (`drizzle-orm/node-postgres`, `pg`).
3. Mova as rotas da API para Serverless Functions (`/api/*`) do Vercel ou faça deploy do `server.ts` como um contêiner no Google Cloud Run.
4. Adicione as chaves de API / DB URL no painel de Environment Variables de produção.
