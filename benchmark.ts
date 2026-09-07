import axios from 'axios';
import { performance } from 'perf_hooks';

async function run() {
  const url = 'http://localhost:3000/api/analysis?lat=-23.5505&lon=-46.6333&radius=2000&period=12m';
  
  console.log('Warming up...');
  for (let i = 0; i < 5; i++) {
    try { await axios.get(url); } catch (e) {}
  }

  console.log('Running 50 requests sequentially...');
  const latencies = [];
  for (let i = 0; i < 50; i++) {
    const start = performance.now();
    try {
      await axios.get(url);
    } catch (e) {}
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  console.log(`Avg: ${avg.toFixed(2)}ms`);
  console.log(`p50: ${p50.toFixed(2)}ms`);
  console.log(`p95: ${p95.toFixed(2)}ms`);
  console.log(`p99: ${p99.toFixed(2)}ms`);
}

run();
