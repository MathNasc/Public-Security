import { db } from '../../db/index.js';
import { dataDatasets, ingestionJobs } from '../../db/schema.js';
import { eq, and, isNull, lt, or, lte } from 'drizzle-orm';
import crypto from 'crypto';
import { Discovery } from './Discovery.js';
import { JobWorker } from './JobWorker.js';

export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  start(intervalMs: number = 60000) {
    if (this.timer) return;
    console.log(`[Scheduler] Started with interval ${intervalMs}ms`);
    this.timer = setInterval(() => this.tick(), intervalMs);
    // Run immediately on start
    setTimeout(() => this.tick(), 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await this.runDiscovery();
      await this.dispatchJobs();
      await this.recoverStuckJobs();
    } catch (e: any) {
      if (e.message && e.message.includes("ENOTFOUND")) {
        console.warn("[Scheduler] Banco de dados offline ou inacessível no ambiente atual.");
      } else {
        console.error("[Scheduler] Error in tick:", e);
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async runDiscovery() {
    // Find datasets that need discovery based on discoveryFrequency
    // For simplicity in MVP, we discover all enabled datasets periodically
    const datasets = await db.select().from(dataDatasets).where(eq(dataDatasets.enabled, true));
    
    for (const dataset of datasets) {
      try {
        const hasUpdate = await Discovery.checkForUpdates(dataset);
        
        if (hasUpdate) {
          console.log(`[Scheduler] New version found for dataset ${dataset.id} (${dataset.name})`);
          // Create job
          await db.insert(ingestionJobs).values({
            id: crypto.randomUUID(),
            datasetId: dataset.id,
            sourceId: dataset.sourceId,
            status: 'queued',
            version: hasUpdate.version,
            retryCount: 0
          });
          
          // Update dataset last_version
          await db.update(dataDatasets)
            .set({ 
              lastDiscoveredAt: new Date(),
              lastVersion: hasUpdate.version 
            })
            .where(eq(dataDatasets.id, dataset.id));
        }
      } catch (e) {
        console.error(`[Scheduler] Discovery failed for ${dataset.id}:`, e);
      }
    }
  }

  private async dispatchJobs() {
    // Trigger workers to pick up queued jobs
    JobWorker.poke();
  }

  private async recoverStuckJobs() {
    // Jobs that have been locked for > 1 hour are considered abandoned
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    const stuckJobs = await db.select().from(ingestionJobs)
      .where(and(
        eq(ingestionJobs.status, 'processing'),
        lte(ingestionJobs.lockedAt, oneHourAgo)
      ));
      
    for (const job of stuckJobs) {
      console.log(`[Scheduler] Recovering stuck job ${job.id}`);
      await db.update(ingestionJobs)
        .set({
          status: 'queued',
          lockedBy: null,
          lockedAt: null
        })
        .where(eq(ingestionJobs.id, job.id));
    }
  }
}

export const globalScheduler = new Scheduler();
