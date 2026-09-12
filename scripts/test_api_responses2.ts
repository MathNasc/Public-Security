import { db } from '../src/db/index.js';

async function run() {
  const res = await fetch('http://localhost:3000/api/analysis?lat=-23.5505&lon=-46.6333&radius=5000');
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}
run();
