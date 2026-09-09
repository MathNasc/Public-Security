import fs from 'fs';

const code = fs.readFileSync('server.ts', 'utf8');

// The phase 10 APIs are between "// Phase 10: Admin APIs" and "app.get("*", (req, res) => {"
const phase10Start = code.indexOf('// Phase 10: Admin APIs');
const phase10End = code.indexOf('app.get("*", (req, res) => {', phase10Start);

if (phase10Start !== -1 && phase10End !== -1) {
    const phase10Code = code.substring(phase10Start, phase10End);
    let newCode = code.replace(phase10Code, '');
    
    // Find where to insert it: before `if (process.env.NODE_ENV !== "production") {`
    const insertPoint = newCode.indexOf('if (process.env.NODE_ENV !== "production") {');
    
    if (insertPoint !== -1) {
        newCode = newCode.slice(0, insertPoint) + phase10Code + '\n  ' + newCode.slice(insertPoint);
        fs.writeFileSync('server.ts', newCode);
        console.log('Successfully moved Phase 10 routes');
    } else {
        console.log('Could not find insert point');
    }
} else {
    console.log('Could not find Phase 10 block');
}
