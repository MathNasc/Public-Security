/**
 * health.ts
 * Endpoints oficiais de diagnóstico e observabilidade do sistema.
 * Distingue Liveness, Readiness, Database, Ingestion Pipeline e Providers Status.
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { metricsCollector } from '../lib/metrics.js';
import { OperationalMetricsService } from '../services/OperationalMetricsService.js';
import { StateRegistry } from '../ingestion/core/index.js';
import { dataSources, dataImports } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

export const healthRouter = Router();

// 1. Liveness Probe (O processo está vivo?)
const handleLiveness = (req: any, res: any) => {
  res.status(200).json({
    status: 'healthy',
    process: 'alive',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
};
healthRouter.get('/live', handleLiveness);
healthRouter.get('/liveness', handleLiveness);

// 2. Readiness Probe (O processo está pronto para atender tráfego?)
const handleReadiness = async (req: any, res: any) => {
  try {
    const dbCheck = await db.execute(sql`SELECT 1 as healthy`);
    const isDbHealthy = Boolean(dbCheck && dbCheck.length > 0);
    
    if (isDbHealthy) {
      res.status(200).json({
        status: 'healthy',
        ready: true,
        database: 'ok',
        storage: 'ok',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        ready: false,
        database: 'failed',
        storage: 'ok',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      ready: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
healthRouter.get('/ready', handleReadiness);
healthRouter.get('/readiness', handleReadiness);

// 3. Database Health Probe (O banco está acessível e qual engine está em uso?)
healthRouter.get('/database', async (req, res) => {
  const startTime = Date.now();
  try {
    const dbCheck = await db.execute(sql`SELECT 1 as ok`);
    const latencyMs = Date.now() - startTime;
    const isPostgres = process.env.DATABASE_URL?.startsWith('postgres') || false;

    res.status(200).json({
      status: 'healthy',
      engine: isPostgres ? 'PostgreSQL/PostGIS' : 'SQLite/LibSQL',
      latencyMs,
      connected: true,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      connected: false,
      latencyMs: Date.now() - startTime,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 4. Ingestion Pipeline Health Probe (O pipeline e os workers estão operacionais?)
healthRouter.get('/ingestion', async (req, res) => {
  try {
    const metrics = await OperationalMetricsService.getMetrics();
    const hasStaleJobs = metrics.jobs.staleCount > 0;
    const isHighFailureRate = metrics.jobs.failureRate > 40;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (hasStaleJobs || isHighFailureRate) {
      status = 'degraded';
    }

    res.status(200).json({
      status,
      activeJobs: metrics.jobs.activeCount,
      staleJobs: metrics.jobs.staleCount,
      successRate: metrics.jobs.successRate,
      failureRate: metrics.jobs.failureRate,
      totalJobsAudited: metrics.jobs.total,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 5. Providers Health Probe (Quais provedores oficiais estão ativos e seu status?)
healthRouter.get('/providers', async (req, res) => {
  try {
    const registered = StateRegistry.listAll();
    const sources = await db.select().from(dataSources);

    const providerStatus = registered.map(p => {
      const def = p.getStateDefinition ? p.getStateDefinition() : null;
      const sourceRecord = sources.find(s => s.id === (def?.primaryProviderId || `SSP-${p.stateCode}`));

      return {
        stateCode: p.stateCode,
        stateName: p.stateName,
        providerName: p.providerName,
        version: (p as any).version || '2.0.0',
        capabilities: p.capabilities,
        status: sourceRecord?.status || 'OPERATIONAL',
        lastAttempt: sourceRecord?.lastAttempt || null,
        lastSuccess: sourceRecord?.lastSuccessfulImport || null,
        lastError: sourceRecord?.errorMessage || null
      };
    });

    res.status(200).json({
      status: 'healthy',
      activeProvidersCount: registered.length,
      providers: providerStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 6. Metrics Aggregator
healthRouter.get('/metrics', async (req, res) => {
  try {
    const httpSummary = metricsCollector.getMetricsSummary();
    const operational = await OperationalMetricsService.getMetrics();

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      http: httpSummary,
      operational
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
