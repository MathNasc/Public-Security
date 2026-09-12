import { dataSources, dataImports, securityOccurrences, securityIndicators, geographicMunicipalities, dataDatasets, regionWatchlists } from './src/db/schema.js';
import { eq, and, gte, lte, asc, sql, isNotNull, isNull, desc } from "drizzle-orm";

import { globalScheduler } from './src/ingestion/orchestration/Scheduler.js';
import { PipelineAutomationService } from './src/ingestion/orchestration/PipelineAutomationService.js';

import { analysisCache } from "./src/lib/cache.js";
import { AutoDownloader } from './src/ingestion/orchestration/AutoDownloader.js';
import { IngestionWorker } from './src/ingestion/pipeline/Worker.js';
import { rawStorage as pipelineRawStorage } from './src/ingestion/pipeline/Storage.js';
import { JobManager } from './src/ingestion/pipeline/JobManager.js';
import crypto, { randomUUID } from 'crypto';
import { publicRouter } from './src/api/public.js';
import express from "express";

import { requestLogger } from './src/middleware/requestLogger.js';
import { adminAuth } from './src/middleware/adminAuth.js';
import { publicApiLimiter, geocodeLimiter } from './src/middleware/rateLimiter.js';

import { SummaryService } from './src/services/SummaryService.js';
import { AiExplanationService } from './src/services/AiExplanationService.js';
import { GeoNormalizationService } from './src/services/GeoNormalizationService.js';
import { healthRouter } from './src/api/health.js';
import { logger } from './src/lib/logger.js';
import cors from "cors";
import path from "path";
import multer from "multer";
import fs from "fs";
import os from "os";
import { db } from "./src/db/index.js";
import { getBoundingBox, haversineDistance } from "./src/lib/geo.js";
import axios from "axios";

export const app = express();
export default app;
app.set("trust proxy", 1);
const PORT = 3000;
const upload = multer({ dest: os.tmpdir() });

app.use(requestLogger);
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Health and Diagnostics
app.use('/health', healthRouter);

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
    res.status(500).json({ error: "Falha ao carregar indicadores consolidados do dashboard." });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/geocode", geocodeLimiter, async (req, res) => {
  const { query } = req.query;
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: "Missing query parameter" });
  }

  try {
    // 0. Detect direct coordinates (e.g., "-23.561, -46.655" or "-23.561 -46.655")
    const coordMatch = query.match(/^\s*(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)\s*$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        const geoNorm = new GeoNormalizationService();
        const nearest = await geoNorm.findNearestMunicipality(lat, lon, 60000);
        return res.json([{
          formattedAddress: nearest 
            ? `${nearest.name} - ${nearest.stateAcronym} (Coordenadas: ${lat.toFixed(5)}, ${lon.toFixed(5)})`
            : `Coordenadas (${lat.toFixed(5)}, ${lon.toFixed(5)})`,
          latitude: lat,
          longitude: lon,
          city: nearest?.name || 'Localização',
          state: nearest?.stateAcronym || 'BR',
          cep: undefined
        }]);
      }
    }

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
      } catch (err: any) {
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
    res.status(500).json({ error: "Falha na geocodificação do endereço solicitado." });
  }
});

import { SafetyAnalysisService } from './src/services/SafetyAnalysisService.js';

app.get("/api/analysis", publicApiLimiter, async (req, res) => {
  const { lat, lon, radius = "1000", period = "12m" } = req.query;
  
  if (!lat || !lon) return res.status(400).json({ error: "Missing coordinates: lat and lon are required." });
  
  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lon as string);

  if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: "Invalid coordinate values provided." });
  }

  let radiusMeters = parseInt(radius as string, 10);
  if (isNaN(radiusMeters) || radiusMeters < 100) radiusMeters = 100;
  if (radiusMeters > 50000) radiusMeters = 50000; // Cap at 50km to prevent DB abuse

  let periodMonths = 12;
  if (period === "3m") periodMonths = 3;
  else if (period === "6m") periodMonths = 6;
  else if (period === "12m") periodMonths = 12;
  else if (period === "all") periodMonths = 60;
  else if (/^\d{4}$/.test(period as string)) periodMonths = 12;
  
  try {
    const cacheKey = `${latitude}_${longitude}_${radiusMeters}_${period}`;
    const cached = analysisCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const service = new SafetyAnalysisService();
    const result = await service.analyze({ lat: latitude, lon: longitude, radiusMeters, periodMonths, periodString: period as string });
    
    const responsePayload = {
      location: { latitude, longitude },
      geographicIdentification: result.geographicIdentification,
      radius: result.radius,
      period: result.period,
      granularity: result.granularity,
      fallback: result.fallback,
      availableData: result.availableData,
      missingData: result.missingData,
      factors: result.factors,
      limitations: result.limitations,
      methodology: result.methodology,
      score: {
        value: result.score !== null ? result.score : null,
        classification: result.status === 'insufficient_data' ? "Dados insuficientes" : (result.score !== null && result.score < 40 ? "Alta atenção" : (result.score !== null && result.score < 75 ? "Atenção moderada" : "Baixa atenção")),
        confidence: result.confidence
      },
      confidence: {
        value: result.confidence,
        level: result.status,
        explanation: result.confidenceExplanation
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
      trend: result.trend,
      dataAbsenceNotice: result.dataAbsenceNotice
    };
    analysisCache.set(cacheKey, responsePayload);
    res.json(responsePayload);

  } catch (err: any) {
    logger.error("Internal Analysis Error", { event: "analysis_error", error: err.message });
    res.status(500).json({ 
      error: "Erro no processamento da análise de segurança.",
      message: "Não foi possível consolidar os indicadores públicos para a coordenada especificada."
    });
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

app.post("/api/ai/explain", publicApiLimiter, async (req, res) => {
  const { query, context, data } = req.body;
  
  // Extract and build structured context payload
  const rawData = context || data || {};
  const resultData = rawData.result || rawData;

  const controlledContext = {
    mode: (rawData.mode || 'qa') as any,
    userQuery: query || rawData.userQuery,
    location: {
      city: resultData?.geographicIdentification?.municipality?.name || rawData?.city || rawData?.municipality || 'Localidade',
      state: resultData?.geographicIdentification?.state?.acronym || rawData?.state || 'BR',
      formattedAddress: resultData?.geographicIdentification?.municipality?.name
    },
    score: {
      value: resultData?.score !== undefined ? resultData.score : (rawData?.score !== undefined ? rawData.score : null),
      classification: rawData?.score?.classification || (resultData?.score !== null ? 'Analisado' : 'Dados insuficientes'),
      confidence: resultData?.confidence !== undefined ? resultData.confidence : (rawData?.confidence || 0)
    },
    period: {
      months: resultData?.period?.months || 12,
      label: resultData?.period?.label || rawData?.period?.label || 'últimos 12 meses'
    },
    indicators: resultData?.indicators || rawData?.indicators || [],
    sources: resultData?.sources || rawData?.sources || rawData?.dataSources || [],
    limitations: resultData?.limitations || rawData?.limitations || [],
    factors: resultData?.factors || rawData?.factors || [],
    fallback: resultData?.fallback || rawData?.fallback || { used: false },
    trend: resultData?.trend || rawData?.trend,
    status: resultData?.status || rawData?.status || (resultData?.indicators?.length > 0 ? 'available' : 'insufficient_data'),
    dataAbsenceNotice: resultData?.dataAbsenceNotice || rawData?.dataAbsenceNotice,
    comparisonData: rawData.comparisonData
  };

  try {
    const service = new AiExplanationService();
    const result = await service.processExplanation(controlledContext);
    res.json({
      response: result.response,
      violations: result.violations,
      modelUsed: result.modelUsed
    });
  } catch (error: any) {
    logger.error("Failed to process AI explanation", { error: error.message });
    res.status(500).json({ error: "Falha ao processar explicação da IA." });
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
    if (sources.length < 28) {
       await db.delete(dataSources);
       sources = [];
    }
    
    // Auto-seed se o banco estiver vazio
    if (sources.length === 0) {
      const ufs = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
      const seedData = [
      { id: "sinesp", name: "SINESP (Nacional)", provider: "Ministério da Justiça", coverage: "Nacional", sourceType: "api", url: "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/sinesp-1/dados-abertos", officialUrl: "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/sinesp-1/dados-abertos", description: "Sistema Nacional de Informações de Segurança Pública", state: "BR", status: "OPERATIONAL" },
      { id: "ssp-sp", name: "Dados Abertos SSP-SP", provider: "SSP-SP", coverage: "SP", sourceType: "html", url: "https://www.ssp.sp.gov.br/transparencia/dados-abertos", officialUrl: "https://www.ssp.sp.gov.br/transparencia/dados-abertos", description: "Secretaria de Segurança Pública de São Paulo", state: "SP", status: "OPERATIONAL" },
      { id: "isp-rj", name: "ISP Dados RJ", provider: "ISP-RJ", coverage: "RJ", sourceType: "api", url: "https://www.ispdados.rj.gov.br/", officialUrl: "https://www.ispdados.rj.gov.br/", description: "Instituto de Segurança Pública do Rio de Janeiro", state: "RJ", status: "OPERATIONAL" },
      { id: "ssp-mg", name: "Dados MG (SEJUSP)", provider: "SEJUSP-MG", coverage: "MG", sourceType: "html", url: "https://www.dados.mg.gov.br/dataset/?organization=secretaria-de-estado-de-justica-e-seguranca-publica-sejusp", officialUrl: "https://www.dados.mg.gov.br/dataset/?organization=secretaria-de-estado-de-justica-e-seguranca-publica-sejusp", description: "Secretaria de Estado de Justiça e Segurança Pública", state: "MG", status: "OPERATIONAL" },
      { id: "ssp-df", name: "Dados Abertos DF", provider: "SSP-DF", coverage: "DF", sourceType: "html", url: "https://dados.df.gov.br/pt/catalogo-dados?theme=seguranca", officialUrl: "https://dados.df.gov.br/pt/catalogo-dados?theme=seguranca", description: "Portal de Dados Abertos do DF - Segurança", state: "DF", status: "OPERATIONAL" },
      { id: "ssp-es", name: "Dados Abertos SESP-ES", provider: "SESP-ES", coverage: "ES", sourceType: "html", url: "https://dados.es.gov.br/organization/sesp-secretaria-de-estado-da-seguranca-publica-e-defesa-social", officialUrl: "https://dados.es.gov.br/organization/sesp-secretaria-de-estado-da-seguranca-publica-e-defesa-social", description: "Secretaria de Estado da Segurança Pública do ES", state: "ES", status: "OPERATIONAL" },
      { id: "ssp-rs", name: "Dados Abertos SSP-RS", provider: "SSP-RS", coverage: "RS", sourceType: "html", url: "https://ssp.rs.gov.br/dados-abertos", officialUrl: "https://ssp.rs.gov.br/dados-abertos", description: "Secretaria de Segurança Pública do RS", state: "RS", status: "OPERATIONAL" }
    ];
    
    const allStates = ['AC','AL','AM','AP','BA','CE','GO','MA','MS','MT','PA','PB','PE','PI','PR','RN','RO','RR','SC','SE','TO'];
    
    for (const st of allStates) {
      seedData.push({
        id: "ssp-" + st.toLowerCase(),
        name: "SSP-" + st,
        provider: "Governo Estadual",
        coverage: st,
        sourceType: "none",
        url: "",
        officialUrl: "",
        description: "Integração pendente",
        state: st,
        status: "PENDING"
      });
    }
      
      await db.insert(dataSources).values(seedData.map(s => ({
        ...s,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: s.status || 'PENDING'
      }))).onConflictDoNothing();
      
      sources = await db.select().from(dataSources);
    }
    
    if (sources && sources.length > 0) {
      sources.sort((a, b) => {
        if (a.id === 'sinesp') return -1;
        if (b.id === 'sinesp') return 1;
        return a.name.localeCompare(b.name);
      });
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
    logger.error("SSP upload processing error", { event: "ssp_upload_error", error: error.message, cause: error.cause ? error.cause.message : null });
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Failed to queue SSP file", details: error.message, cause: error.cause ? error.cause.message : null });
  }
});



app.post("/api/admin/automation/trigger-all", adminAuth, async (req, res) => {
  try {
    const jobs = await AutoDownloader.triggerAll();
    res.json({ success: true, message: `${jobs} fontes verificadas com sucesso! Status dos Links Oficiais atualizados.` });
  } catch (err: any) {
    console.error("Erro na automação:", err);
    const rootCause = err.cause ? (err.cause.message || err.cause) : err.message;
    res.status(500).json({ error: "Falha: " + rootCause });
  }
});

// Vite Middleware for Development or Static Files for Production
// Phase 10: Admin APIs
app.get("/api/admin/ingestion/status", async (req, res) => {
  try {
    const rawJobs = await db.select().from(dataImports).orderBy(desc(dataImports.createdAt)).limit(10);
    const datasets = await db.select().from(dataDatasets);
    const jobs = rawJobs.map(j => ({
      id: j.id,
      sourceId: j.sourceId,
      version: j.datasetId || 'v1',
      status: (j.status || 'queued').toLowerCase(),
      updatedAt: j.finishedAt || j.startedAt || j.createdAt,
      recordsRead: j.recordsRead,
      recordsInserted: j.recordsInserted
    }));
    res.json({ jobs, datasets });
  } catch (error: any) {
    res.json({ jobs: [], datasets: [] });
  }
});

app.post("/api/admin/ingestion/discovery", async (req, res) => {
  try {
    await globalScheduler.tick();
    res.json({ success: true, message: "Discovery de fontes executado com sucesso." });
  } catch (error: any) {
    res.status(500).json({ error: "Falha ao executar discovery: " + error.message });
  }
});

// Phase 11: Pipeline Automation & Operational Telemetry
app.get("/api/admin/pipeline/operational-status", async (req, res) => {
  try {
    const sourceId = (req.query.source as string) || "SSP-SP";
    const status = await PipelineAutomationService.getOperationalStatus(sourceId);
    res.json(status);
  } catch (error: any) {
    logger.error("Failed to fetch operational status", { error: error.message });
    res.status(500).json({ error: "Falha ao obter status operacional: " + error.message });
  }
});

app.post("/api/admin/pipeline/trigger-ssp", async (req, res) => {
  try {
    const force = Boolean(req.body?.force);
    const result = await PipelineAutomationService.runAutomationCycle({ force });
    res.json(result);
  } catch (error: any) {
    logger.error("Failed to trigger SSP automation cycle", { error: error.message });
    res.status(500).json({ error: "Falha ao disparar automação: " + error.message });
  }
});

app.post("/api/admin/pipeline/reprocess/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await JobManager.reprocessJob(jobId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    // Re-executa via pipeline resiliente
    PipelineAutomationService.executeJobWithResilience(jobId).catch(err => {
      logger.error("Reprocess background execution error", { error: err.message });
    });
    res.json({ success: true, message: `Job ${jobId} reenfileirado e em reprocessamento.` });
  } catch (error: any) {
    res.status(500).json({ error: "Falha ao reprocessar job: " + error.message });
  }
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