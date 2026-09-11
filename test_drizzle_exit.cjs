const { execSync } = require('child_process');
try {
  execSync('echo "n" | npx drizzle-kit push --config=drizzle.config.test.ts', { stdio: 'pipe' });
} catch (e) {
  console.log("Exit code:", e.status);
}
