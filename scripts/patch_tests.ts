import fs from 'fs';
import path from 'path';

const testDir = path.join(process.cwd(), 'tests');
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const p = path.join(testDir, file);
  let content = fs.readFileSync(p, 'utf8');
  
  // Replace createJob({ ... force: true }) with new fields
  content = content.replace(/force:\s*true\s*\n\s*\}/g, 
    "force: true,\n    sourceType: 'fixture',\n    environment: 'test',\n    isOfficialPublication: false,\n    isEligibleForProductionAutomation: false\n  }");
  
  // same for force: false
  content = content.replace(/force:\s*false([^\n]*)\n\s*\}/g, 
    "force: false$1,\n    sourceType: 'fixture',\n    environment: 'test',\n    isOfficialPublication: false,\n    isEligibleForProductionAutomation: false\n  }");
    
  fs.writeFileSync(p, content);
  console.log(`Patched ${file}`);
}
