/**
 * OperationalMetricsService.ts
 * Serviço de consolidação de métricas operacionais em tempo real para observabilidade.
 */

import { db } from '../db/index.js';
import { dataImports, dataSources, dataDatasets, securityOccurrences, securityIndicators } from '../db/schema.js';
import { sql, eq, desc, and } from 'drizzle-orm';
import { JobStateMachine, JobState } from '../ingestion/core/index.js';

export interface ComprehensiveOperationalMetrics {
  timestamp: string;
  system: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptimeSeconds: number;
    nodeEnv: string;
    databaseType: 'PostgreSQL/PostGIS' | 'SQLite/LibSQL';
  };
  jobs: {
    total: number;
    byStatus: Record<JobState, number>;
    successRate: number; // 0-100%
    failureRate: number; // 0-100%
    activeCount: number;
    staleCount: number;
  };
  providers: Array<{
    sourceId: string;
    stateCode: string;
    status: string;
    lastSuccess: string | null;
    lastAttempt: string | null;
    lastError: string | null;
    recordsImported: number;
  }>;
  dataTotals: {
    occurrences: number;
    indicators: number;
    imports: number;
  };
}

export class OperationalMetricsService {
  private static readonly startTime = Date.now();

  public static async getMetrics(): Promise<ComprehensiveOperationalMetrics> {
    const now = new Date();
    const isPostgres = process.env.DATABASE_URL?.startsWith('postgres') || false;
    const databaseType = isPostgres ? 'PostgreSQL/PostGIS' : 'SQLite/LibSQL';

    // 1. Contagens de dados gerais
    let occurrencesCount = 0;
    let indicatorsCount = 0;
    let importsCount = 0;

    try {
      const occRes = await db.select({ count: sql`count(*)` }).from(securityOccurrences);
      occurrencesCount = Number(occRes[0]?.count || 0);

      const indRes = await db.select({ count: sql`count(*)` }).from(securityIndicators);
      indicatorsCount = Number(indRes[0]?.count || 0);

      const impRes = await db.select({ count: sql`count(*)` }).from(dataImports);
      importsCount = Number(impRes[0]?.count || 0);
    } catch (e) {
      // Caso DB indisponível
    }

    // 2. Análise de jobs
    const jobsByStatus: Record<JobState, number> = {
      pending: 0,
      running: 0,
      retrying: 0,
      succeeded: 0,
      succeeded_with_warnings: 0,
      failed: 0,
      cancelled: 0,
      stale: 0,
      blocked: 0
    };

    let totalJobs = 0;
    let staleCount = 0;

    try {
      const allJobs = await db.select().from(dataImports).orderBy(desc(dataImports.createdAt)).limit(500);
      totalJobs = allJobs.length;

      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

      for (const j of allJobs) {
        const norm = JobStateMachine.normalize(j.status);
        
        // Checagem de Stale em memória
        if (norm === 'running' && j.lockedAt && new Date(j.lockedAt) < fifteenMinsAgo) {
          jobsByStatus.stale++;
          staleCount++;
        } else {
          jobsByStatus[norm] = (jobsByStatus[norm] || 0) + 1;
        }
      }
    } catch (e) {
      // Ignora erro de consulta temporária
    }

    const completedTotal = jobsByStatus.succeeded + jobsByStatus.succeeded_with_warnings;
    const successRate = totalJobs > 0 ? Number(((completedTotal / totalJobs) * 100).toFixed(2)) : 100;
    const failureRate = totalJobs > 0 ? Number(((jobsByStatus.failed / totalJobs) * 100).toFixed(2)) : 0;

    // 3. Status de fontes oficiais
    let providersMetrics: ComprehensiveOperationalMetrics['providers'] = [];
    try {
      const sources = await db.select().from(dataSources);
      providersMetrics = sources.map(s => ({
        sourceId: s.id,
        stateCode: s.state || 'SP',
        status: s.status || 'OPERATIONAL',
        lastSuccess: s.lastSuccessfulImport ? s.lastSuccessfulImport.toISOString() : null,
        lastAttempt: s.lastAttempt ? s.lastAttempt.toISOString() : null,
        lastError: s.errorMessage,
        recordsImported: s.recordsImported || 0
      }));
    } catch (e) {
      // Ignora
    }

    // Determina status global do sistema
    let systemStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (staleCount > 0 || failureRate > 30) {
      systemStatus = 'degraded';
    }
    if (totalJobs > 0 && jobsByStatus.failed === totalJobs) {
      systemStatus = 'unhealthy';
    }

    return {
      timestamp: now.toISOString(),
      system: {
        status: systemStatus,
        uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        nodeEnv: process.env.NODE_ENV || 'development',
        databaseType
      },
      jobs: {
        total: totalJobs,
        byStatus: jobsByStatus,
        successRate,
        failureRate,
        activeCount: jobsByStatus.running + jobsByStatus.pending,
        staleCount
      },
      providers: providersMetrics,
      dataTotals: {
        occurrences: occurrencesCount,
        indicators: indicatorsCount,
        imports: importsCount
      }
    };
  }
}
