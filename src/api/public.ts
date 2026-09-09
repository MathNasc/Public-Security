import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db/index';
import { securityOccurrences, securityIndicators, geographicMunicipalities, geographicStates } from '../db/schema';
import { desc, eq, and, sql } from 'drizzle-orm';

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

// 2. Simple API Key Middleware
// In a real scenario, this would check against an 'apiKeys' table in the DB.
const requireApiKey = (req: any, res: any, next: any) => {
  const apiKey = req.header('X-API-Key');
  // For Phase 5, we accept a static test key or an env variable.
  const validKey = process.env.PUBLIC_API_KEY || 'test_api_key_123';
  
  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing X-API-Key header' });
  }
  next();
};

publicRouter.use('/v1', requireApiKey);

// 3. Endpoint: Get Aggregate Indicators
publicRouter.get('/v1/indicators', async (req, res) => {
  try {
    const { uf, category, period } = req.query;
    
    // Build dynamic where conditions
    const conditions = [];
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

// 4. Endpoint: Get Latest Occurrences (Geospatial bounds optional)
publicRouter.get('/v1/occurrences', async (req, res) => {
  try {
    const { lat, lon, radius, category, limit } = req.query;
    
    const parsedLimit = limit ? parseInt(String(limit), 10) : 50;
    const finalLimit = parsedLimit > 500 ? 500 : parsedLimit; // Hard cap at 500 for performance
    
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
       // Order by distance if spatial search
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
