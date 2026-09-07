import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import dotenv from "dotenv";

dotenv.config();

let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString || connectionString.startsWith("file:")) { connectionString = "postgres://postgres:postgres@localhost:5432/postgres"; }

if (!connectionString) { console.warn("No DATABASE_URL found"); }

export const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });
