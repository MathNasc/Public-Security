const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// It looks like the patch mistakenly injected another import and DataQualityTab duplicate at the end of the file.
// Let's strip out the duplicate part.
const badDuplicateIndex = code.lastIndexOf("import React from 'react';");
if (badDuplicateIndex > 500) { // Should only be at the top
  code = code.substring(0, badDuplicateIndex);
}

fs.writeFileSync('src/pages/Admin.tsx', code);
