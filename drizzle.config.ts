import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle-pg", // Use a different folder for PG migrations to not conflict
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  }
});
