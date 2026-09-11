const postgres = require('postgres');
require('dotenv').config();
async function test() {
  const sql = postgres(process.env.DATABASE_URL);
  try {
     await sql`insert into "data_imports" ("id", "source_id", "dataset_id", "status") values ('test_id', 'SSP-SP', 'test', 'QUEUED')`;
     console.log("Success");
  } catch(e) {
     console.error(e);
  }
  process.exit();
}
test();
