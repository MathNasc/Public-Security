const { execSync } = require('child_process');
const fs = require('fs');

fs.writeFileSync('schema_test.ts', `
import { pgTable, text } from "drizzle-orm/pg-core";
export const test = pgTable("test", { id: text("id").primaryKey() });
`);
fs.writeFileSync('drizzle.config.test.ts', `
import { defineConfig } from "drizzle-kit";
export default defineConfig({ schema: "./schema_test.ts", dialect: "postgresql", dbCredentials: { url: "postgres://postgres:postgres@localhost:5432/postgres" } });
`);
