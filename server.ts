import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.js";
import { dataSources, occurrences, importBatches } from "./src/db/schema.js";
import { getBoundingBox, haversineDistance } from "./src/lib/geo.js";
import { and, gte, lte, asc, sql, isNotNull, isNull, desc } from "drizzle-orm";
import { DataIngestionService } from "./src/services/DataIngestionService.js";
import axios from "axios";
import { importSspFile } from "./src/ingestion/ssp/importer.js";

const app = express();
const PORT = 3000;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// API Routes

app.get("/api/admin/data-quality", async (req, res) => {
  try {
    // Basic stats
    const totalRecords = (await db.select({ count: sql`count(*)` }).from(occurrences))[0].count;
    
    // Coordinates
    const withCoords = (await db.select({ count: sql`count(*)` }).from(occurrences).where(isNotNull(occurrences.latitude)))[0].count;
    const withoutCoords = totalRecords - withCoords;
    
    // Geocoding status
    const geocoded = (await db.select({ count: sql`count(*)` }).from(occurrences).where(eq(occurrences.geocodingStatus, 'geocoded')))[0].count;
    const geoFailed = (await db.select({ count: sql`count(*)` }).from(occurrences).where(eq(occurrences.geocodingStatus, 'failed')))[0].count;
    const notEnoughData = (await db.select({ count: sql`count(*)` }).from(occurrences).where(eq(occurrences.geocodingStatus, 'not_enough_data')))[0].count;
    
    // Dates
    const oldestDateRow = await db.select({ minDate: sql`min(occurred_at)` }).from(occurrences).where(isNotNull(occurrences.occurredAt));
    const newestDateRow = await db.select({ maxDate: sql`max(occurred_at)` }).from(occurrences).where(isNotNull(occurrences.occurredAt));
    const oldestDate = oldestDateRow[0]?.minDate ? new Date(oldestDateRow[0].minDate).toISOString() : null;
    const newestDate = newestDateRow[0]?.maxDate ? new Date(newestDateRow[0].maxDate).toISOString() : null;
    
    const withoutDate = (await db.select({ count: sql`count(*)` }).from(occurrences).where(isNull(occurrences.occurredAt)))[0].count;
    
    // Categories
    const categoriesRows = await db.select({
      category: occurrences.category,
      count: sql`count(*)`
    }).from(occurrences).groupBy(occurrences.category);
    
    // Batches
    const batches = await db.select().from(importBatches).orderBy(desc(importBatches.startedAt)).limit(10);
    
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
      categories: categoriesRows,
      recentBatches: batches
    });
  } catch (error) {
    console.error("Error fetching data quality:", error);
    res.status(500).json({ error: "Failed to fetch data quality" });
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
    const bbox = getBoundingBox(latitude, longitude, radiusMeters);

    // 1. Filter via database (fast BBox + Date)
    const dbConditions: any[] = [
      gte(occurrences.latitude, bbox.minLat),
      lte(occurrences.latitude, bbox.maxLat),
      gte(occurrences.longitude, bbox.minLon),
      lte(occurrences.longitude, bbox.maxLon),
      gte(occurrences.occurredAt, cutoffDate)
    ];
    if (isSpecificYear) {
      dbConditions.push(lte(occurrences.occurredAt, endDate));
    }

    const rawOccurrences = await db.select().from(occurrences).where(
      and(...dbConditions)
    ).orderBy(asc(occurrences.occurredAt));

    // 2. Exact filter in memory using Haversine
    const exactOccurrences = rawOccurrences.filter(o => 
      haversineDistance(latitude, longitude, o.latitude, o.longitude) <= radiusMeters
    );

    // Statistics calculation
    let total = exactOccurrences.length;
    let thefts = 0, robberies = 0, vehicles = 0, others = 0;
    let day = 0, night = 0;

    const trendMap: Record<string, number> = {};
    const othersBreakdown: Record<string, number> = {};

    exactOccurrences.forEach(o => {
      const sub = (o.subcategory || "").toLowerCase();
      const cat = (o.category || "").toLowerCase();

      if (cat.includes("veículo") || cat.includes("veiculo") || sub.includes("veículo") || sub.includes("veiculo")) {
        vehicles++;
      } else if (cat.includes("roubo") || sub.includes("roubo")) {
        robberies++;
      } else if (cat.includes("furto") || sub.includes("furto")) {
        thefts++;
      } else {
        others++;
        const desc = o.subcategory || o.category || "Não especificado";
        othersBreakdown[desc] = (othersBreakdown[desc] || 0) + 1;
      }

      const date = new Date(o.occurredAt);
      const hour = date.getHours();
      if (hour >= 6 && hour < 18) day++;
      else night++;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      trendMap[monthKey] = (trendMap[monthKey] || 0) + 1;
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

    // Safety Score Algorithm (Actual calculation based on density/period)
    // Assuming a baseline of X incidents per sq km per year is "bad"
    const areaSqKm = (Math.PI * Math.pow(radiusMeters / 1000, 2));
    const annualMultiplier = 12 / periodMonths;
    const annualizedIncidents = total * annualMultiplier;
    const incidentsPerSqKm = annualizedIncidents / areaSqKm;

    // Severity weighting: Robberies cost more points than thefts
    const severityWeightedIncidents = 
      (robberies * 2) + 
      (vehicles * 1.5) + 
      (thefts * 1) + 
      (others * 0.5);

    const weightedDensity = (severityWeightedIncidents * annualMultiplier) / areaSqKm;

    // Base score 100. Let's say a density of 500 weighted incidents/sqkm/yr drops the score to 0.
    const scoreVal = Math.max(0, Math.min(100, Math.round(100 - (weightedDensity / 5))));
    
    let classification = "Baixa atenção";
    if (total < 5) classification = "Dados insuficientes"; // Special case
    else if (scoreVal < 40) classification = "Alta atenção";
    else if (scoreVal < 75) classification = "Atenção moderada";

    const sources = await db.select().from(dataSources);

    res.json({
      location: { latitude, longitude },
      radius: radiusMeters,
      period,
      score: {
        value: total < 5 ? 0 : scoreVal, // 0 visually if insufficient, UI handles it
        classification,
        confidence: total < 5 ? 0.3 : (total < 20 ? 0.6 : 0.9), // lower confidence for few data points
      },
      statistics: {
        total,
        robberies,
        thefts,
        vehicles,
        others,
        othersBreakdown,
        dayPercentage: total > 0 ? Math.round((day / total) * 100) : 0,
        nightPercentage: total > 0 ? Math.round((night / total) * 100) : 0,
      },
      trend,
      occurrences: exactOccurrences.map(o => ({
        category: o.category,
        subcategory: o.subcategory,
        latitude: o.latitude,
        longitude: o.longitude,
        occurredAt: o.occurredAt,
        locationPrecision: o.locationPrecision
      })),
      dataSources: sources
    });
  } catch (err: any) {
    console.error("Analysis Error:", err);
    res.status(500).json({ error: "Failed to perform analysis" });
  }
});

app.get("/api/data-sources", async (req, res) => {
  try {
    const sources = await db.select().from(dataSources);
    res.json(sources);
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
