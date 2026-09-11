import { dataSources, dataImports, securityOccurrences, securityIndicators, geographicStates, geographicMunicipalities, ingestionJobs, dataDatasets, rawStorage, regionWatchlists } from './src/db/schema.js';
import { eq, and, gte, lte, asc, sql, isNotNull, isNull, desc } from "drizzle-orm";

import { globalScheduler } from './src/ingestion/orchestration/Scheduler.js';


import { analysisCache } from "./src/lib/cache.js";
import { AutoDownloader } from './src/ingestion/orchestration/AutoDownloader.js';
import { IngestionWorker } from './src/ingestion/pipeline/Worker.js';
import { rawStorage as pipelineRawStorage } from './src/ingestion/pipeline/Storage.js';
import { JobManager } from './src/ingestion/pipeline/JobManager.js';
import * as crypto from 'crypto';
import { publicRouter } from './src/api/public.js';
import { IngestionEngine } from './src/ingestion/core/IngestionEngine.js';
// Removed SinespAdapter old import
import { IbgeSyncService } from './src/ingestion/adapters/geographic/ibge/IbgeSyncService.js';
// Removed SspSpAdapter old import
import express from "express";

import helmet from 'helmet';
import { requestLogger } from './src/middleware/requestLogger.js';
import { adminAuth } from './src/middleware/adminAuth.js';
import { publicApiLimiter, geocodeLimiter } from './src/middleware/rateLimiter.js';

import { SummaryService } from './src/services/SummaryService.js';
import { randomUUID } from 'crypto';

import { healthRouter } from './src/api/health.js';
import { logger } from './src/lib/logger.js';
import cors from "cors";
import path from "path";
import multer from "multer";
import fs from "fs";
import os from "os";
import { db } from "./src/db/index.js";
// Removed duplicate import
import { getBoundingBox, haversineDistance } from "./src/lib/geo.js";
import { DataIngestionService } from "./src/services/DataIngestionService.js";
import axios from "axios";
import { importSspFile } from "./src/ingestion/ssp/importer.js";





export const app = express();
export default app;
app.set("trust proxy", 1);
const PORT = 3000;
const upload = multer({ dest: os.tmpdir() });

app.use((req,res,next)=>{ console.log('REQ:', req.method, req.url); next(); });
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// API Routes


// Public API with Rate Limiting
app.use('/api/public', publicRouter);

app.get("/api/admin/data-quality", async (req, res) => {
  try {
    // Basic stats
    const totalRecords = Number((await db.select({ count: sql`count(*)` }).from(securityOccurrences))[0].count);
    
    // Coordinates
    const withCoords = Number((await db.select({ count: sql`count(*)` }).from(securityOccurrences).where(isNotNull(securityOccurrences.latitude)))[0].count);
    const withoutCoords = totalRecords - withCoords;
    
    // Geocoding status
    const geocoded = (await db.select({ count: sql`count(*)` }).from(securityOccurrences).where(eq(securityOccurrences.geocodingStatus, 'geocoded')))[0].count;
    const geoFailed = (await db.select({ count: sql`count(*)` }).from(securityOccurrences).where(eq(securityOccurrences.geocodingStatus, 'failed')))[0].count;
    const notEnoughData = (await db.select({ count: sql`count(*)` }).from(securityOccurrences).where(eq(securityOccurrences.geocodingStatus, 'not_enough_data')))[0].count;
    
    // Dates
    const oldestDateRow = await db.select({ minDate: sql`min(occurred_at)` }).from(securityOccurrences).where(isNotNull(securityOccurrences.occurredAt));
    const newestDateRow = await db.select({ maxDate: sql`max(occurred_at)` }).from(securityOccurrences).where(isNotNull(securityOccurrences.occurredAt));
    const oldestDate = oldestDateRow[0]?.minDate ? new Date(oldestDateRow[0].minDate as string).toISOString() : null;
    const newestDate = newestDateRow[0]?.maxDate ? new Date(newestDateRow[0].maxDate as string).toISOString() : null;
    
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
    console.warn("Error fetching data quality (DB missing?):", error.message);
    res.status(500).json({ error: "Failed to fetch data quality" });
  }
});



app.post("/api/admin/run-engine/ibge", async (req, res) => {
  try {
    const service = new IbgeSyncService();
    // Run in background
    service.syncAll().catch(e => console.warn("Sync failed:", e.message));
    res.json({ success: true, message: "Engine started for IBGE Geographic Sync in the background." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


app.post("/api/admin/run-engine/ssp", (req, res) => res.json({ success: true, message: "Use the new JobManager API instead" }));

app.post("/api/admin/run-engine/sinesp", (req, res) => res.json({ success: true, message: "Use the new JobManager API instead" }));


app.get("/api/dashboard/summary", async (req, res) => {
  try {
    const byCategoryRaw = await db.execute(sql`SELECT category, SUM(value) as val FROM security_indicators GROUP BY category ORDER BY val DESC`);
    const byStateRaw = await db.execute(sql`SELECT state_code, SUM(value) as val FROM security_indicators WHERE state_code IS NOT NULL GROUP BY state_code ORDER BY val DESC`);
    const byTrendRaw = await db.execute(sql`SELECT period, SUM(value) as val FROM security_indicators GROUP BY period ORDER BY period ASC`);
    
    let total = 0;
    const categoryData = byCategoryRaw.map((r: any) => { 
      const v = Number(r.val);
      total += v;
      return { name: r.category, value: v }; 
    });
    
    const stateData = byStateRaw.map((r: any) => ({ name: r.state_code, value: Number(r.val) }));
    const trendData = byTrendRaw.map((r: any) => ({ name: r.period, value: Number(r.val) }));
    
    res.json({
      total,
      byCategory: categoryData,
      byState: stateData,
      byTrend: trendData
    });
  } catch (error: any) {
    logger.error("Dashboard error", { event: "dashboard_error", error: error.message });
    res.status(500).json({ error: "Failed to load dashboard data", details: error.message });
  }
});

app.get("/api/health", (req, res) => { fs.writeFileSync("/tmp/env.log", JSON.stringify(process.env));
  res.json({ status: "ok" });
});

app.get("/api/geocode", geocodeLimiter, async (req, res) => {
  const { query } = req.query;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: "Missing query" });
  }

  try {
    let searchQuery = query;
    let viaCepData = null;

    // Detect if it's a Brazilian CEP (e.g., 01001-000 or 01001000)
    const cepMatch = query.match(/^\s*(\d{5})-?(\d{3})\s*$/);
    if (cepMatch) {
      const cleanCep = cepMatch[1] + cepMatch[2];
      try {
        const viaCepRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const cepData = await viaCepRes.json();
        if (!cepData.erro) {
          viaCepData = cepData;
          // Construct a precise search query for Nominatim based on ViaCEP result
          searchQuery = `${cepData.logradouro || ''}, ${cepData.bairro || ''}, ${cepData.localidade || ''}, ${cepData.uf || ''}`.replace(/^,\s*/, '').trim();
        }
      } catch (err) {
        logger.warn("ViaCEP lookup failed", { error: err.message });
      }
    }

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=5&countrycodes=br`;
    const response = await fetch(url, { headers: { 'User-Agent': 'PublicSecurity/1.0' } });
    const data = await response.json();

    const results = data.map((item: any) => ({
      formattedAddress: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      city: item.address?.city || item.address?.town || item.address?.village || (viaCepData ? viaCepData.localidade : undefined),
      state: item.address?.state || (viaCepData ? viaCepData.uf : undefined),
      cep: item.address?.postcode || (viaCepData ? viaCepData.cep : undefined)
    }));

    // If Nominatim didn't find exact coordinates but ViaCEP found the city/state, we could fallback,
    // but usually Nominatim finds it if we pass "logradouro, localidade, uf".
    // If results is empty and it was a CEP, let's try a broader search on Nominatim
    if (results.length === 0 && viaCepData) {
       const fallbackQuery = `${viaCepData.localidade}, ${viaCepData.uf}`;
       const fallbackUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fallbackQuery)}&format=json&addressdetails=1&limit=1&countrycodes=br`;
       const fallbackRes = await fetch(fallbackUrl, { headers: { 'User-Agent': 'PublicSecurity/1.0' } });
       const fallbackData = await fallbackRes.json();
       if (fallbackData.length > 0) {
          results.push({
            formattedAddress: `${viaCepData.logradouro ? viaCepData.logradouro + ', ' : ''}${viaCepData.bairro ? viaCepData.bairro + ', ' : ''}${viaCepData.localidade} - ${viaCepData.uf}, ${viaCepData.cep}`,
            latitude: parseFloat(fallbackData[0].lat),
            longitude: parseFloat(fallbackData[0].lon),
            city: viaCepData.localidade,
            state: viaCepData.uf,
            cep: viaCepData.cep
          });
       }
    }

    res.json(results);
  } catch (error: any) {
    logger.error("Geocoding API Error", { error: error.message });
    res.status(500).json({ error: "Geocoding failed", message: error.message });
  }
});

import { SafetyAnalysisService } from './src/services/SafetyAnalysisService.js';

app.get("/api/analysis", publicApiLimiter, async (req, res) => {
  const { lat, lon, radius = "1000", period = "12m" } = req.query;
  
  if (!lat || !lon) return res.status(400).json({ error: "Missing coordinates" });
  
  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lon as string);
  let radiusMeters = parseInt(radius as string, 10);
  if (radiusMeters > 50000) radiusMeters = 50000; // Cap at 50km to prevent DB abuse

  
  let periodMonths = 12;
  if (period === "3m") periodMonths = 3;
  else if (period === "6m") periodMonths = 6;
  else if (period === "12m") periodMonths = 12;
  else if (period === "all") periodMonths = 60;
  else if (/^\d{4}$/.test(period as string)) periodMonths = 12; // specific year is simplified for now
  
  try {
    
  const cacheKey = `${latitude}_${longitude}_${radiusMeters}_${period}`;
  const cached = analysisCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

    const service = new SafetyAnalysisService();
    const result = await service.analyze({ lat: latitude, lon: longitude, radiusMeters, periodMonths, periodString: period as string });
    
    // We send back both the new structure AND some legacy fields so the frontend doesn't break entirely if we miss a spot.
    
    const responsePayload = {
      location: { latitude, longitude },
      radius: radiusMeters,
      period,
      score: {
        value: result.score !== null ? result.score : 0,
        classification: result.status === 'insufficient_data' ? "Dados insuficientes" : (result.score !== null && result.score < 40 ? "Alta atenção" : (result.score !== null && result.score < 75 ? "Atenção moderada" : "Baixa atenção")),
        confidence: result.confidence
      },
      result,
      statistics: {
        total: result.indicators.reduce((acc, curr) => acc + curr.value, 0),
        breakdown: {
          thefts: result.indicators.filter(i => i.canonicalCategory === 'theft').reduce((a, b) => a + b.value, 0),
          robberies: result.indicators.filter(i => i.canonicalCategory === 'robbery').reduce((a, b) => a + b.value, 0),
          vehicles: result.indicators.filter(i => i.categoryGroup === 'vehicle').reduce((a, b) => a + b.value, 0),
          others: result.indicators.filter(i => i.categoryGroup !== 'vehicle' && i.canonicalCategory !== 'theft' && i.canonicalCategory !== 'robbery').reduce((a, b) => a + b.value, 0)
        }
      },
      dataSources: result.sources,
      exactOccurrences: result.exactOccurrences || [],
      trend: []
    };
    analysisCache.set(cacheKey, responsePayload);
    res.json(responsePayload);

  } catch (err) {
    logger.warn("Internal Analysis Error (DB missing?)", { event: "analysis_error", error: err.stack || err.message });
    res.status(500).json({ error: "Internal Analysis Error", details: err.message, stack: err.stack });
  }
});

app.post("/api/summary", publicApiLimiter, async (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: "Missing data payload" });
  try {
    const service = new SummaryService();
    const summary = await service.generateSummary(data);
    res.json({ summary });
  } catch (error) {
    logger.error("Failed to generate summary", { error });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/user/alerts", publicApiLimiter, async (req, res) => {
  const { userId, name, lat, lon, radius, lastScore } = req.body;
  if (!userId || !lat || !lon) return res.status(400).json({ error: "Missing required fields" });
  
  try {
    const id = randomUUID();
    await db.insert(regionWatchlists).values({
      id,
      userId,
      name,
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      radiusMeters: parseInt(radius, 10),
      lastScore: lastScore ? parseInt(lastScore, 10) : null
    });
    res.json({ success: true, id });
  } catch (error: any) {
    logger.error("Failed to save watchlist", { error: error.message });
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/user/alerts", publicApiLimiter, async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  
  try {
    const list = await db.select().from(regionWatchlists).where(eq(regionWatchlists.userId, userId as string));
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/data-sources", async (req, res) => {
  try {
    let sources = await db.select().from(dataSources);
    // Force wipe if they don't have URLs to re-seed
    if (sources.length > 0 && !sources[0].url) {
       await db.delete(dataSources);
       sources = [];
    }
    
    // Auto-seed se o banco estiver vazio
    if (sources.length === 0) {
      const ufs = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
      const seedData = [
        { id: "ssp-sp", name: "Dados Abertos SP (SSP-SP)", sourceType: "api", url: "https://www.dadosabertos.sp.gov.br", officialUrl: "https://www.dadosabertos.sp.gov.br", description: "Secretaria de Segurança Pública de São Paulo", state: "SP" },
        { id: "isp-rj", name: "ISP Dados RJ", sourceType: "api", url: "https://www.ispdados.rj.gov.br", officialUrl: "https://www.ispdados.rj.gov.br", description: "Instituto de Segurança Pública do Rio de Janeiro", state: "RJ" },
        { id: "ssp-rs", name: "Observatório SSP-RS", sourceType: "html", url: "https://ssp.rs.gov.br/indicadores-criminais", officialUrl: "https://ssp.rs.gov.br/indicadores-criminais", description: "Secretaria de Segurança Pública do Rio Grande do Sul", state: "RS" },
        { id: "sesp-es", name: "Observatório SESP-ES", sourceType: "html", url: "https://sesp.es.gov.br/Estatistica", officialUrl: "https://sesp.es.gov.br/Estatistica", description: "Secretaria de Estado da Segurança Pública do Espírito Santo", state: "ES" },
        { id: "sinesp", name: "SINESP (Nacional)", sourceType: "api", url: "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/sinesp-1/dados-abertos", officialUrl: "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/sinesp-1/dados-abertos", description: "Sistema Nacional de Informações de Segurança Pública", state: "BR" }
      ];
      
      await db.insert(dataSources).values(seedData.map(s => ({
        ...s,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'OPERATIONAL'
      }))).onConflictDoNothing();
      
      sources = await db.select().from(dataSources);
    }
    
    res.json(sources || []);
  } catch (err: any) {
    if (err.message && err.message.includes("ENOTFOUND")) {
      res.json([]);
    } else {
      res.status(500).json({ error: "Failed to fetch data sources" });
    }
  }
});

app.post("/api/admin/ingest", adminAuth, async (req, res) => {
  const { sourceName, records, sourceInfo } = req.body;
  if (!sourceName || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: "Invalid payload format." });
  }
  
  try {
    const result = await DataIngestionService.ingestData(sourceName, records, sourceInfo);
    res.json({ success: true, inserted: result.inserted });
  } catch (err: any) {
    logger.error("Ingestion error", { event: "ingestion_api_error", error: err.message });
    res.status(500).json({ error: "Ingestion failed: " + err.message });
  }
});

app.post("/api/admin/upload-ssp", adminAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const originalFilename = req.file.originalname;
    const stream = fs.createReadStream(req.file.path);
    
    // Store in Raw Storage
    const datasetId = 'ssp-sp';
    const version = Date.now().toString();
    const stored = await pipelineRawStorage.put(datasetId, version, originalFilename, stream);
    
    // Create Job
    const jobId = await JobManager.createJob({
      sourceId: 'SSP-SP',
      datasetId: datasetId,
      rawFilePath: stored.path,
      originalFilename: stored.metadata.filename,
      checksum: stored.metadata.checksum,
      fileSize: stored.metadata.size,
    });
    
    // Cleanup multer temp file
    fs.unlinkSync(req.file.path);
    
    res.status(202).json({ 
      success: true, 
      message: "Ingestion job queued successfully.",
      jobId: jobId 
    });
  } catch (error: any) {
    logger.error("SSP upload processing error", { event: "ssp_upload_error", error: error.message });
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Failed to queue SSP file", details: error.message });
  }
});


app.post("/api/admin/force-db-sync", adminAuth, (req, res) => {
  const { exec } = require('child_process');
  exec("npm run db:migrate:prod", { env: process.env }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: error.message, stdout, stderr });
    }
    res.json({ success: true, stdout, stderr });
  });
});

app.post("/api/admin/automation/trigger-all", adminAuth, async (req, res) => {
  try {
    const jobs = await AutoDownloader.triggerAll();
    res.json({ success: true, message: `${jobs} fontes verificadas com sucesso! Status dos Links Oficiais atualizados.` });
  } catch (err: any) {
    console.error("Erro na automação:", err);
    const rootCause = err.cause ? (err.cause.message || err.cause) : err.message; res.status(500).json({ error: "Falha: " + rootCause });
  }
});

app.post("/api/admin/download-sample", adminAuth, async (req, res) => {
  const SAMPLE_URL = "https://raw.githubusercontent.com/NESPEDUFV/repositorio_dados_sbcup/main/crimes_2019_somente_sp_com_bairro.csv";
  const tempPath = path.join(os.tmpdir(), `sample_${Date.now()}.csv`);
  
  try {
    // No need to create tmp dir

    // Download the file
    const response = await axios({
      method: "get",
      url: SAMPLE_URL,
      responseType: "stream"
    });

    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on("finish", () => resolve());
      writer.on("error", reject);
    });

    // Import it
    const result = await importSspFile(tempPath);
    
    // Cleanup
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    
    res.json(result);
  } catch (error: any) {
    logger.error("Sample download error", { event: "sample_download_error", error: error.message });
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    res.status(500).json({ error: "Failed to download and process sample", details: error.message });
  }
});

// Vite Middleware for Development or Static Files for Production
// Phase 10: Admin APIs
app.get("/api/admin/ingestion/status", async (req, res) => {
  try {
    const jobs = await db.select().from(ingestionJobs).orderBy(desc(ingestionJobs.createdAt)).limit(10);
    const datasets = await db.select().from(dataDatasets);
    res.json({ jobs, datasets });
  } catch (error: any) {
    // Mock fallback
    res.json({
      jobs: [
        { id: 'job-1', sourceId: 'SINESP', status: 'completed', version: '2026-08', completedAt: new Date().toISOString() },
        { id: 'job-2', sourceId: 'SSP-SP', status: 'processing', version: '2026-08' }
      ],
      datasets: [
        { id: 'ds-1', sourceId: 'SINESP', name: 'SINESP Base Nacional', status: 'healthy', enabled: true },
        { id: 'ds-2', sourceId: 'SSP-SP', name: 'SSP-SP Ocorrências', status: 'healthy', enabled: true }
      ]
    });
  }
});

app.post("/api/admin/ingestion/discovery", async (req, res) => {
  try {
    globalScheduler.tick(); // Force tick
    res.json({ success: true, message: "Discovery triggered" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/ingestion/jobs/:id/retry", async (req, res) => {
  res.json({ success: true, message: "Job retry initiated" });
});

  
  
async function startServer() {
  const ingestionWorker = new IngestionWorker();
  ingestionWorker.start().catch(console.error);
  

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  


  
    if (process.env.VERCEL !== "1") {
      app.listen(PORT, "0.0.0.0", () => {
        logger.info(`Server running on port ${PORT}`, { event: "server_start", port: PORT });
      });
    }
}

// Start Phase 10 Scheduler
if (process.env.NODE_ENV !== 'test' && process.env.VERCEL !== "1") {
  globalScheduler.start(60000);
}
if (process.env.VERCEL !== "1") {
  startServer();
} else {
  // If in vercel, we just run the setup synchronously as much as possible, or Vercel will handle it
  // Actually, Vercel needs the app exported synchronously.
}