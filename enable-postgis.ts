import postgres from "postgres";
import dotenv from "dotenv";
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function test() {
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS postgis`;
    console.log("PostGIS enabled!");
    process.exit(0);
  } catch (e) {
    console.error("Failed:", e);
    process.exit(1);
  }
}
test();
