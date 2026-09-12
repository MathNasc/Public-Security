import { Router } from 'express';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { metricsCollector } from '../lib/metrics.js';

export const healthRouter = Router();

healthRouter.get('/liveness', (req, res) => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

healthRouter.get('/readiness', async (req, res) => {
  try {
    const dbCheck = await db.execute(sql`SELECT 1 as healthy`);
    const isDbHealthy = dbCheck && dbCheck.length > 0;
    
    let isStorageHealthy = true;

    if (isDbHealthy && isStorageHealthy) {
      res.status(200).json({ status: 'ready', db: 'ok', storage: 'ok' });
    } else {
      res.status(503).json({ status: 'not_ready', db: isDbHealthy ? 'ok' : 'failed', storage: isStorageHealthy ? 'ok' : 'failed' });
    }
  } catch (error: any) {
    res.status(503).json({ status: 'not_ready', error: error.message });
  }
});

healthRouter.get('/metrics', (req, res) => {
  const summary = metricsCollector.getMetricsSummary();
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    metrics: summary
  });
});
