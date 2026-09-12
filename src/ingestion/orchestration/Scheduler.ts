import { db } from '../../db/index.js';
import { dataDatasets, dataImports } from '../../db/schema.js';
import { eq, and, lte } from 'drizzle-orm';
import { Discovery } from './Discovery.js';
import { JobManager } from '../pipeline/JobManager.js';
import { rawStorage } from '../pipeline/Storage.js';
import { PipelineAutomationService } from './PipelineAutomationService.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';

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
      // 1. Executa ciclo autônomo da fonte validada (SSP-SP)
      await PipelineAutomationService.runAutomationCycle();
      // 2. Descoberta de outros datasets habilitados
      await this.runDiscovery();
      // 3. Recuperação de jobs presos
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

  async triggerSource(sourceId: string, force: boolean = false) {
    if (sourceId === 'SSP-SP') {
      return await PipelineAutomationService.runAutomationCycle({ force });
    }
    return { success: false, reason: `Automação ainda não ativada para ${sourceId}.` };
  }

  private async runDiscovery() {
    // Find datasets that need discovery based on discoveryFrequency
    const datasets = await db.select().from(dataDatasets).where(eq(dataDatasets.enabled, true));
    
    for (const dataset of datasets) {
      try {
        const hasUpdate = await Discovery.checkForUpdates(dataset);
        
        if (hasUpdate) {
          console.log(`[Scheduler] Nova versão descoberta para o dataset ${dataset.id} (${dataset.name}): v${hasUpdate.version}`);
          
          let rawFilePath = '';
          let checksum = '';
          let fileSize = 0;
          const originalFilename = `${dataset.id}-${hasUpdate.version}.csv`;

          if (dataset.discoveryUrl) {
            try {
              const res = await axios.get(dataset.discoveryUrl, { responseType: 'stream', timeout: 30000 });
              const stored = await rawStorage.put(dataset.id, hasUpdate.version, originalFilename, res.data);
              rawFilePath = stored.path;
              checksum = stored.metadata.checksum;
              fileSize = stored.metadata.size;
            } catch (err: any) {
              console.warn(`[Scheduler] Falha no download de ${dataset.discoveryUrl}: ${err.message}`);
              continue;
            }
          } else {
            // Verifica se há amostra de referência local para o dataset
            const potentialLocal = [
              path.join(process.cwd(), 'uploads', 'ssp-sample.csv'),
              path.join(process.cwd(), 'raw_storage', dataset.id, '2024-01', 'sinesp_sample.csv')
            ];
            for (const p of potentialLocal) {
              if (fs.existsSync(p)) {
                const content = fs.readFileSync(p);
                rawFilePath = path.relative(process.cwd(), p);
                checksum = crypto.createHash('sha256').update(content).digest('hex');
                fileSize = content.length;
                break;
              }
            }
          }

          if (!rawFilePath || !fs.existsSync(path.isAbsolute(rawFilePath) ? rawFilePath : path.join(process.cwd(), rawFilePath))) {
            console.log(`[Scheduler] Dataset ${dataset.id} não possui arquivo RAW disponível para criar job. Aguardando upload ou download oficial.`);
            continue;
          }

          // Cria Job oficial no pipeline
          await JobManager.createJob({
            sourceId: dataset.sourceId,
            datasetId: dataset.id,
            rawFilePath,
            originalFilename,
            checksum,
            fileSize,
          });
          
          // Atualiza last_version do dataset
          await db.update(dataDatasets)
            .set({ 
              lastDiscoveredAt: new Date(),
              lastVersion: hasUpdate.version 
            })
            .where(eq(dataDatasets.id, dataset.id));
        }
      } catch (e: any) {
        console.error(`[Scheduler] Discovery failed for ${dataset.id}:`, e.message);
      }
    }
  }

  private async recoverStuckJobs() {
    // Jobs that have been locked for > 1 hour are considered abandoned
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    const stuckJobs = await db.select().from(dataImports)
      .where(and(
        eq(dataImports.status, 'PROCESSING'),
        lte(dataImports.lockedAt, oneHourAgo)
      ));
      
    for (const job of stuckJobs) {
      console.log(`[Scheduler] Recovering stuck job ${job.id}`);
      await db.update(dataImports)
        .set({
          status: 'QUEUED',
          workerId: null,
          lockedAt: null
        })
        .where(eq(dataImports.id, job.id));
    }
  }
}

export const globalScheduler = new Scheduler();
