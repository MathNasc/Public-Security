const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

if (!code.trim().endsWith("export default Admin;")) {
  code += `
          </div>
        )}
        
        {activeTab === 'analysis' && <DataQualityTab />}
      </div>
    </div>
  );
}
export default Admin;
  `;
}

fs.writeFileSync('src/pages/Admin.tsx', code);
