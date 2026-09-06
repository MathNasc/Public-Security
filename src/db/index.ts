import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString || connectionString.startsWith("file:")) {
  throw new Error("DATABASE_URL must be a PostgreSQL connection string for Phase 1. SQLite fallback is disabled.");
}

const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });
