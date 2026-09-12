for i in {1..4}; do
  sqlite3 data/local_radar.db "SELECT original_filename, status FROM data_imports WHERE status != 'completed';"
  sleep 10
done
