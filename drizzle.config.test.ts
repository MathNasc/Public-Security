
import { defineConfig } from "drizzle-kit";
export default defineConfig({ schema: "./schema_test.ts", dialect: "postgresql", dbCredentials: { url: "postgres://postgres:postgres@localhost:5432/postgres" } });
