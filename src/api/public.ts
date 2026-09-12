import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db/index.js';
import { securityOccurrences, securityIndicators } from '../db/schema.js';
import { desc, eq, and, sql } from 'drizzle-orm';
import { SafetyAnalysisService } from '../services/SafetyAnalysisService.js';
import { GeoNormalizationService } from '../services/GeoNormalizationService.js';

const publicRouter = Router();

// 1. Rate Limiter: max 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiter to all /v1 routes
publicRouter.use('/v1', apiLimiter);

// 2. API Key Middleware
const requireApiKey = (req: any, res: any, next: any) => {
  const apiKey = req.header('X-API-Key');
  const validKey = process.env.PUBLIC_API_KEY || 'test_api_key_123';
  
  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing X-API-Key header' });
  }
  next();
};

publicRouter.use('/v1', requireApiKey);

// 3. Endpoint: Safety Analysis (Full Public Flow: Geocoding -> Identification -> Availability -> Indicators -> Score -> Confidence -> Limitations)
publicRouter.get('/v1/analysis', async (req, res) => {
  try {
    const { lat, lon, radius = "1000", period = "12m" } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Missing coordinates: "lat" and "lon" are required query parameters.' });
    }

    const latitude = parseFloat(String(lat));
    const longitude = parseFloat(String(lon));
    let radiusMeters = parseInt(String(radius), 10);
    if (isNaN(radiusMeters) || radiusMeters < 100) radiusMeters = 100;
    if (radiusMeters > 50000) radiusMeters = 50000;

    let periodMonths = 12;
    if (period === "3m") periodMonths = 3;
    else if (period === "6m") periodMonths = 6;
    else if (period === "12m") periodMonths = 12;
    else if (period === "all") periodMonths = 60;
    else if (/^\d{4}$/.test(String(period))) periodMonths = 12;

    const service = new SafetyAnalysisService();
    const result = await service.analyze({
      lat: latitude,
      lon: longitude,
      radiusMeters,
      periodMonths,
      periodString: String(period)
    });

    res.json(result);
  } catch (error: any) {
    console.warn("Public API Error (Analysis):", error.message);
    res.status(500).json({
      error: 'Erro no processamento da análise de segurança.',
      message: 'Não foi possível completar a consulta de indicadores criminais para as coordenadas fornecidas.'
    });
  }
});

// 4. Endpoint: Geocoding (Address, CEP, Coordinates)
publicRouter.get('/v1/geocode', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Missing query: "query" parameter is required.' });
    }

    // Direct Coordinates
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
          state: nearest?.stateAcronym || 'BR'
        }]);
      }
    }

    // CEP
    let searchQuery = query;
    let viaCepData = null;
    const cepMatch = query.match(/^\s*(\d{5})-?(\d{3})\s*$/);
    if (cepMatch) {
      const cleanCep = cepMatch[1] + cepMatch[2];
      try {
        const viaCepRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const cepData = await viaCepRes.json();
        if (!cepData.erro) {
          viaCepData = cepData;
          searchQuery = `${cepData.logradouro || ''}, ${cepData.bairro || ''}, ${cepData.localidade || ''}, ${cepData.uf || ''}`.replace(/^,\s*/, '').trim();
        }
      } catch {}
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
    console.warn("Public API Error (Geocode):", error.message);
    res.status(500).json({ error: 'Falha na geocodificação do endereço solicitado.' });
  }
});

// 5. Endpoint: Get Aggregate Indicators
publicRouter.get('/v1/indicators', async (req, res) => {
  try {
    const { uf, category, period, source, sourceId } = req.query;
    
    const conditions = [];
    const src = source || sourceId;
    if (src) conditions.push(eq(securityIndicators.sourceId, String(src).toUpperCase()));
    if (uf) conditions.push(eq(securityIndicators.stateCode, String(uf).toUpperCase()));
    if (category) conditions.push(eq(securityIndicators.category, String(category)));
    if (period) conditions.push(eq(securityIndicators.period, String(period)));
    
    const query = db.select().from(securityIndicators);
    if (conditions.length > 0) {
      query.where(and(...conditions));
    }
    
    query.orderBy(desc(securityIndicators.period)).limit(100);
    
    const results = await query;
    res.json({
      meta: { count: results.length },
      data: results
    });
  } catch (error: any) {
    console.warn("API Error (Indicators):", error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 6. Endpoint: Get Latest Occurrences (Geospatial bounds optional)
publicRouter.get('/v1/occurrences', async (req, res) => {
  try {
    const { lat, lon, radius, category, limit } = req.query;
    
    const parsedLimit = limit ? parseInt(String(limit), 10) : 50;
    const finalLimit = parsedLimit > 500 ? 500 : parsedLimit;
    
    const conditions = [];
    if (category) conditions.push(eq(securityOccurrences.category, String(category)));
    
    let isSpatial = false;
    if (lat && lon && radius) {
      isSpatial = true;
      const latitude = parseFloat(String(lat));
      const longitude = parseFloat(String(lon));
      const radiusMeters = parseInt(String(radius), 10);
      const degreeRadius = radiusMeters / 111320.0;
      
      conditions.push(sql`geom && ST_Expand(ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326), ${degreeRadius})`);
      conditions.push(sql`ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) <= ${radiusMeters}`);
    }

    const query = db.select().from(securityOccurrences);
    if (conditions.length > 0) {
      query.where(and(...conditions));
    }
    
    if (isSpatial) {
       const latitude = parseFloat(String(lat));
       const longitude = parseFloat(String(lon));
       query.orderBy(sql`ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) ASC`);
    } else {
       query.orderBy(desc(securityOccurrences.occurredAt));
    }
    
    query.limit(finalLimit);
    
    const results = await query;
    res.json({
      meta: { count: results.length, limit: finalLimit },
      data: results
    });
  } catch (error: any) {
    console.warn("API Error (Occurrences):", error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export { publicRouter };
