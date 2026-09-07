import { execSync } from 'child_process';
try {
  // Use echo to pipe answers to drizzle-kit if it prompts, or we can just drop the table in a custom migration
  execSync('npx drizzle-kit drop', { stdio: 'inherit' });
} catch (e) {
  console.log("Failed");
}
