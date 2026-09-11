const fs = require('fs');
let code = fs.readFileSync('src/ingestion/pipeline/Worker.ts', 'utf8');
code = code.replace(
  /while \(this\.isRunning\) \{\s+const job = await this\.claimJob\(\);\s+if \(job\) \{\s+await this\.processJob\(job\);\s+\} else \{\s+await new Promise\(r => setTimeout\(r, 5000\)\);\s+\}\s+\}/g,
  `while (this.isRunning) {
      try {
        const job = await this.claimJob();
        if (job) {
          await this.processJob(job);
        } else {
          await new Promise(r => setTimeout(r, 5000));
        }
      } catch (e: any) {
        if (e.message && e.message.includes("ENOTFOUND")) {
           console.warn(\`[Worker \${this.workerId}] Banco offline no preview.\`);
        } else {
           console.error(\`[Worker \${this.workerId}] Error in loop:\`, e.message);
        }
        await new Promise(r => setTimeout(r, 10000));
      }
    }`
);
fs.writeFileSync('src/ingestion/pipeline/Worker.ts', code);
