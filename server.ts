import { publicRouter } from './src/api/public.js';
import { IngestionEngine } from './src/ingestion/core/IngestionEngine.js';
import { SinespAdapter } from './src/ingestion/adapters/federal/sinesp/SinespAdapter.js';
import { dataSources, dataImports, securityOccurrences, securityIndicators } from './src/db/schema.js';
import { IbgeSyncService } from './src/ingestion/adapters/geographic/ibge/IbgeSyncService.js';
import { geographicStates, geographicMunicipalities } from './src/db/schema.js';
import { SspSpAdapter } from './src/ingestion/adapters/ssp-sp/SspSpAdapter.js';
import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.js";
import { dataSources, securityOccurrences, dataImports } from "./src/db/schema.js";
import { getBoundingBox, haversineDistance } from "./src/lib/geo.js";
import { eq, and, gte, lte, asc, sql, isNotNull, isNull, desc } from "drizzle-orm";
import { DataIngestionService } from "./src/services/DataIngestionService.js";
import axios from "axios";
import { importSspFile } from "./src/ingestion/ssp/importer.js";





const app = express();
const PORT = 3000;
const upload = multer({ dest: 'uploads/' });

app.use((req,res,next)=>{ console.log('REQ:', req.method, req.url); next(); });
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// API Routes


// Public API with Rate Limiting
app.use('/api/public', publicRouter);

app.get("/api/admin/data-quality", async (req, res) => {
  try {
    // Basic stats
    const totalRecords = (await db.select({ count: sql`count(*)` }).from(securityOccurrences))[0].count;
    
    // Coordinates
    const withCoords = (await db.select({ count: sql`count(*)` }).from(securityOccurrences).where(isNotNull(securityOccurrences.latitude)))[0].count;
    const withoutCoords = totalRecords - withCoords;
    
    // Geocoding status
    const geocoded = (await db.select({ count: sql`count(*)` }).from(securityOccurrences).where(eq(securityOccurrences.geocodingStatus, 'geocoded')))[0].count;
    const geoFailed = (await db.select({ count: sql`count(*)` }).from(securityOccurrences).where(eq(securityOccurrences.geocodingStatus, 'failed')))[0].count;
    const notEnoughData = (await db.select({ count: sql`count(*)` }).from(securityOccurrences).where(eq(securityOccurrences.geocodingStatus, 'not_enough_data')))[0].count;
    
    // Dates
    const oldestDateRow = await db.select({ minDate: sql`min(occurred_at)` }).from(securityOccurrences).where(isNotNull(securityOccurrences.occurredAt));
    const newestDateRow = await db.select({ maxDate: sql`max(occurred_at)` }).from(securityOccurrences).where(isNotNull(securityOccurrences.occurredAt));
    const oldestDate = oldestDateRow[0]?.minDate ? new Date(oldestDateRow[0].minDate).toISOString() : null;
    const newestDate = newestDateRow[0]?.maxDate ? new Date(newestDateRow[0].maxDate).toISOString() : null;
    
    const withoutDate = (await db.select({ count: sql`count(*)` }).from(securityOccurrences).where(isNull(securityOccurrences.occurredAt)))[0].count;
    
    // Categories
    const categoriesRows = await db.select({
      category: securityOccurrences.category,
      count: sql`count(*)`
    }).from(securityOccurrences).groupBy(securityOccurrences.category);
    
    // Batches
    const batches = await db.select().from(dataImports).orderBy(desc(dataImports.startedAt)).limit(10);
    
    res.json({
      coverage: {
        total: totalRecords,
        withCoordinates: withCoords,
        withoutCoordinates: withoutCoords,
        geocoded: geocoded,
        failedGeocoding: geoFailed,
        notEnoughData: notEnoughData
      },
      temporal: {
        oldest: oldestDate,
        newest: newestDate,
        withoutDate: withoutDate
      },
      categories: categoriesRows || [],
      recentBatches: batches || []
    });
  } catch (error) {
    console.error("Error fetching data quality:", error);
    res.status(500).json({ error: "Failed to fetch data quality" });
  }
});



app.post("/api/admin/run-engine/ibge", async (req, res) => {
  try {
    const service = new IbgeSyncService();
    // Run in background
    service.syncAll().catch(console.error);
    res.json({ success: true, message: "Engine started for IBGE Geographic Sync in the background." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


app.post("/api/admin/run-engine/ssp", async (req, res) => {
  try {
    const engine = new IngestionEngine();
    const sspAdapter = new SspSpAdapter();
    // Run in background
    engine.runJob(sspAdapter).catch(console.error);
    res.json({ success: true, message: "Engine started for SSP-SP in the background." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/run-engine/sinesp", async (req, res) => {
  try {
    const engine = new IngestionEngine();
    const sinesp = new SinespAdapter();
    // Run in background
    engine.runJob(sinesp).catch(console.error);
    res.json({ success: true, message: "Engine started for SINESP in the background." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/geocode", async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query as string)}&format=json&limit=5`;
    const response = await fetch(url, { headers: { 'User-Agent': 'VizinhancaMVP/1.0' } });
    const data = await response.json();

    const results = data.map((item: any) => ({
      formattedAddress: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      city: item.address?.city || item.address?.town || item.address?.village,
      state: item.address?.state,
    }));

    res.json(results);
  } catch (error) {
    console.error("Geocoding error:", error);
    res.status(500).json({ error: "Failed to geocode address" });
  }
});

app.get("/api/analysis", async (req, res) => {
  const { lat, lon, radius = "1000", period = "12m" } = req.query;
  
  if (!lat || !lon) return res.status(400).json({ error: "Missing coordinates" });

  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lon as string);
  const radiusMeters = parseInt(radius as string, 10);
  
  let periodMonths = 12;
  let cutoffDate = new Date();
  let endDate = new Date();
  let isSpecificYear = false;
  let isAllHistory = false;

  if (period === "3m") {
    periodMonths = 3;
    cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
  } else if (period === "6m") {
    periodMonths = 6;
    cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
  } else if (period === "12m") {
    periodMonths = 12;
    cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
  } else if (period === "all") {
    isAllHistory = true;
    periodMonths = 60; // 5 years baseline approx
    cutoffDate = new Date("2000-01-01T00:00:00Z");
  } else if (/^\d{4}$/.test(period as string)) {
    isSpecificYear = true;
    periodMonths = 12;
    const year = parseInt(period as string, 10);
    cutoffDate = new Date(`${year}-01-01T00:00:00Z`);
    endDate = new Date(`${year}-12-31T23:59:59.999Z`);
  } else {
    cutoffDate.setMonth(cutoffDate.getMonth() - periodMonths);
  }

  try {
    const degreeRadius = radiusMeters / 111320.0;
    
    // Core database filters mapped to PostGIS
    const dbConditions: any[] = [
      sql`geom && ST_Expand(ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326), ${degreeRadius})`,
      sql`ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) <= ${radiusMeters}`,
      gte(securityOccurrences.occurredAt, cutoffDate)
    ];
    if (isSpecificYear) {
      dbConditions.push(lte(securityOccurrences.occurredAt, endDate));
    }
    const whereClause = and(...dbConditions);

    // 1. Fetch aggregations (Total, categories, day/night) directly from PostgreSQL
    const aggregateResult = await db.select({
      total: sql<number>`COUNT(*)::int`,
      robberies: sql<number>`SUM(CASE WHEN LOWER(category) LIKE '%roubo%' OR LOWER(subcategory) LIKE '%roubo%' THEN 1 ELSE 0 END)::int`,
      thefts: sql<number>`SUM(CASE WHEN LOWER(category) LIKE '%furto%' OR LOWER(subcategory) LIKE '%furto%' THEN 1 ELSE 0 END)::int`,
      vehicles: sql<number>`SUM(CASE WHEN LOWER(category) LIKE '%veículo%' OR LOWER(category) LIKE '%veiculo%' OR LOWER(subcategory) LIKE '%veículo%' OR LOWER(subcategory) LIKE '%veiculo%' THEN 1 ELSE 0 END)::int`,
      day: sql<number>`SUM(CASE WHEN EXTRACT(HOUR FROM occurred_at) >= 6 AND EXTRACT(HOUR FROM occurred_at) < 18 THEN 1 ELSE 0 END)::int`,
      night: sql<number>`SUM(CASE WHEN EXTRACT(HOUR FROM occurred_at) < 6 OR EXTRACT(HOUR FROM occurred_at) >= 18 THEN 1 ELSE 0 END)::int`,
    }).from(securityOccurrences).where(whereClause);
    
    const stats = aggregateResult[0] || { total: 0, robberies: 0, thefts: 0, vehicles: 0, day: 0, night: 0 };
    const total = stats.total || 0;
    const robberies = stats.robberies || 0;
    const thefts = stats.thefts || 0;
    const vehicles = stats.vehicles || 0;
    const day = stats.day || 0;
    const night = stats.night || 0;
    const others = total - robberies - thefts - vehicles;
    
    // 2. Fetch Time Trend grouped by Month directly from PostgreSQL
    const trendResult = await db.select({
      monthKey: sql<string>`TO_CHAR(occurred_at, 'YYYY-MM')`,
      count: sql<number>`COUNT(*)::int`
    })
    .from(securityOccurrences)
    .where(whereClause)
    .groupBy(sql`TO_CHAR(occurred_at, 'YYYY-MM')`);
    
    const trendMap: Record<string, number> = {};
    trendResult.forEach(row => {
      if (row.monthKey) trendMap[row.monthKey] = row.count;
    });

    // Fill missing months for trend
    const trend = [];
    if (isSpecificYear) {
      const year = parseInt(period as string, 10);
      for (let m = 1; m <= 12; m++) {
        const k = `${year}-${String(m).padStart(2, '0')}`;
        trend.push({ month: k, count: trendMap[k] || 0 });
      }
    } else if (isAllHistory) {
      const keys = Object.keys(trendMap).sort();
      for (const k of keys) {
        trend.push({ month: k, count: trendMap[k] });
      }
    } else {
      for (let i = periodMonths - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        trend.push({ month: k, count: trendMap[k] || 0 });
      }
    }

    // 3. Others Breakdown (Fallback query for 'others' category text grouping)
    let othersBreakdown: Record<string, number> = {};
    if (others > 0) {
       const breakdownResult = await db.select({
         desc: sql<string>`COALESCE(subcategory, category, 'Não especificado')`,
         count: sql<number>`COUNT(*)::int`
       })
       .from(securityOccurrences)
       .where(and(
         whereClause,
         sql`LOWER(category) NOT LIKE '%roubo%' AND LOWER(subcategory) NOT LIKE '%roubo%'`,
         sql`LOWER(category) NOT LIKE '%furto%' AND LOWER(subcategory) NOT LIKE '%furto%'`,
         sql`LOWER(category) NOT LIKE '%veículo%' AND LOWER(category) NOT LIKE '%veiculo%' AND LOWER(subcategory) NOT LIKE '%veículo%' AND LOWER(subcategory) NOT LIKE '%veiculo%'`
       ))
       .groupBy(sql`COALESCE(subcategory, category, 'Não especificado')`)
       .orderBy(desc(sql`COUNT(*)`))
       .limit(10);
       
       breakdownResult.forEach(row => {
         othersBreakdown[row.desc] = row.count;
       });
    }

    // Safety Score Algorithm (Preserved exactly as original)
    const areaSqKm = (Math.PI * Math.pow(radiusMeters / 1000, 2));
    const annualMultiplier = 12 / periodMonths;
    const annualizedIncidents = total * annualMultiplier;
    const incidentsPerSqKm = annualizedIncidents / areaSqKm;

    const severityWeightedIncidents = 
      (robberies * 2) + 
      (vehicles * 1.5) + 
      (thefts * 1) + 
      (others * 0.5);

    const weightedDensity = (severityWeightedIncidents * annualMultiplier) / areaSqKm;

    const scoreVal = Math.max(0, Math.min(100, Math.round(100 - (weightedDensity / 5))));
    
    let classification = "Baixa atenção";
    if (total < 5) classification = "Dados insuficientes"; // Special case
    else if (scoreVal < 40) classification = "Alta atenção";
    else if (scoreVal < 75) classification = "Atenção moderada";

    const sources = await db.select().from(dataSources);
    const exactOccurrences = await db.select().from(securityOccurrences).where(whereClause).limit(100);

    res.json({
      location: { latitude, longitude },
      radius: radiusMeters,
      period,
      score: {
        value: scoreVal,
        classification: classification,
        confidence: 0.8
      },
      statistics: {
        total,
        breakdown: {
          thefts,
          robberies,
          vehicles,
          others,
          othersBreakdown,
        },
        dayPercentage: total > 0 ? Math.round((day / total) * 100) : 0,
        nightPercentage: total > 0 ? Math.round((night / total) * 100) : 0,
      },
      trend,
      occurrences: exactOccurrences,
      dataSources: sources.map(s => ({ name: s.name, provider: s.provider, lastUpdated: s.lastAttempt }))
    });
  } catch (error: any) {
    console.error("API Error (Analysis):", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/data-sources", async (req, res) => {
  try {
    const sources = await db.select().from(dataSources);
    res.json(sources || []);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch data sources" });
  }
});

app.post("/api/admin/ingest", async (req, res) => {
  const { sourceName, records, sourceInfo } = req.body;
  if (!sourceName || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: "Invalid payload format." });
  }
  
  try {
    const result = await DataIngestionService.ingestData(sourceName, records, sourceInfo);
    res.json({ success: true, inserted: result.inserted });
  } catch (err: any) {
    console.error("Ingestion error:", err);
    res.status(500).json({ error: "Ingestion failed: " + err.message });
  }
});

app.post("/api/admin/upload-ssp", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const result = await importSspFile(req.file.path);
    // Cleanup temp file
    fs.unlinkSync(req.file.path);
    res.json(result);
  } catch (error: any) {
    console.error("SSP upload processing error:", error);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Failed to process SSP file", details: error.message });
  }
});

app.post("/api/admin/download-sample", async (req, res) => {
  const SAMPLE_URL = "https://raw.githubusercontent.com/NESPEDUFV/repositorio_dados_sbcup/main/crimes_2019_somente_sp_com_bairro.csv";
  const tempPath = path.join(process.cwd(), "uploads", `sample_${Date.now()}.csv`);
  
  try {
    if (!fs.existsSync(path.join(process.cwd(), "uploads"))) {
      fs.mkdirSync(path.join(process.cwd(), "uploads"));
    }

    // Download the file
    const response = await axios({
      method: "get",
      url: SAMPLE_URL,
      responseType: "stream"
    });

    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // Import it
    const result = await importSspFile(tempPath);
    
    // Cleanup
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    
    res.json(result);
  } catch (error: any) {
    console.error("Sample download error:", error);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    res.status(500).json({ error: "Failed to download and process sample", details: error.message });
  }
});

// Vite Middleware for Development or Static Files for Production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  


  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
