const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { pgTable, text } = require('drizzle-orm/pg-core');

const sql = postgres('postgres://postgres:postgres@localhost:5432/postgres');
const db = drizzle(sql);

const nonExistent = pgTable('does_not_exist', { id: text('id') });

async function run() {
  try {
    await db.select().from(nonExistent);
  } catch (e) {
    console.log("e.message:", e.message);
    console.log("e.cause:", e.cause);
    console.log("String(e):", String(e));
    if (e.cause) console.log("e.cause.message:", e.cause.message);
  }
  process.exit(0);
}
run();
