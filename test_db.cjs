const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

const sql = postgres('postgres://postgres:postgres@localhost:5432/postgres');
const db = drizzle(sql);

async function run() {
  try {
    const res = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log("Tables in public schema:", res.map(r => r.table_name));
  } catch (e) {
    console.log("e.message:", e.message);
  }
  process.exit(0);
}
run();
