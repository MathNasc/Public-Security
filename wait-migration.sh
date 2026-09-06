while true; do
  npx tsx src/db/validate-migration.ts > tmp-val.txt
  mismatch=$(grep "MISMATCH" tmp-val.txt | wc -l)
  if [ "$mismatch" -eq 0 ]; then
    echo "Migration fully completed!"
    cat tmp-val.txt
    break
  else
    echo "Waiting for migration... (Mismatches left: $mismatch)"
    sleep 5
  fi
done
