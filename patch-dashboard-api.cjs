const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const dashboardApi = `
app.get("/api/dashboard/summary", async (req, res) => {
  try {
    const indicators = await db.select().from(securityIndicators);
    
    let total = 0;
    const byCategory = {};
    const byState = {};
    const trend = {};

    indicators.forEach(ind => {
      const val = ind.value;
      total += val;
      
      byCategory[ind.category] = (byCategory[ind.category] || 0) + val;
      if (ind.stateCode) {
        byState[ind.stateCode] = (byState[ind.stateCode] || 0) + val;
      }
      
      const period = ind.period;
      trend[period] = (trend[period] || 0) + val;
    });

    const categoryData = Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
    const stateData = Object.entries(byState).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
    const trendData = Object.entries(trend).map(([name, value]) => ({ name, value })).sort((a,b) => a.name.localeCompare(b.name));

    res.json({
      total,
      byCategory: categoryData,
      byState: stateData,
      trend: trendData
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});
`;

code = code.replace("app.get(\"/api/health\",", dashboardApi + "\napp.get(\"/api/health\",");
fs.writeFileSync('server.ts', code);
console.log("Added /api/dashboard/summary");
