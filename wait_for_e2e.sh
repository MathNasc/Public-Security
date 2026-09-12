for i in {1..6}; do
  npx tsx scripts/check_metrics.ts
  sleep 10
done
