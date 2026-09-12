const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('data/local_radar.db');
db.all("SELECT source_id, original_filename, error_message FROM data_imports WHERE status = 'failed' COLLATE NOCASE", (err, rows) => {
  if (err) console.error(err);
  else console.log(rows);
});
