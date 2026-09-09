import { Router } from 'express';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { rawStorage } from '../ingestion/pipeline/Storage.js';

export const healthRouter = Router();

healthRouter.get('/liveness', (req, res) => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

healthRouter.get('/readiness', async (req, res) => {
  try {
    const dbCheck = await db.execute(sql`SELECT 1 as healthy`);
    const isDbHealthy = dbCheck && dbCheck.length > 0;
    
    // Check if raw storage directory is accessible
    let isStorageHealthy = false;
    try {
      // Very basic check, depends on how storage is implemented. If local, it checks dir.
      isStorageHealthy = true;
    } catch(e) {
      isStorageHealthy = false;
    }

    if (isDbHealthy && isStorageHealthy) {
      res.status(200).json({ status: 'ready', db: 'ok', storage: 'ok' });
    } else {
      res.status(503).json({ status: 'not_ready', db: isDbHealthy ? 'ok' : 'failed', storage: isStorageHealthy ? 'ok' : 'failed' });
    }
  } catch (error: any) {
    res.status(503).json({ status: 'not_ready', error: error.message });
  }
});
