const fs = require('fs');
let content = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
content = content.replace(
  '  useEffect(() => {\n    await fetchSources();\n  }, []);',
  '  useEffect(() => {\n    fetchSources();\n  }, []);'
);
fs.writeFileSync('src/pages/Admin.tsx', content);
