import postgres from "postgres";
import dotenv from "dotenv";
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function test() {
  try {
    const res = await sql`SELECT id, status, checkpoint, records_read, records_inserted, attempts FROM data_imports`;
    console.table(res);
    process.exit(0);
  } catch (e) {
    console.error("Failed:", e);
    process.exit(1);
  }
}
test();
