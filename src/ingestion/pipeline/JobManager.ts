import { db } from '../../db/index.js';
import { dataImports } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export interface CreateJobResult {
  jobId: string;
  isDuplicate?: boolean;
  status: string;
}

export class JobManager {
  /**
   * Criação de Job com validação de Idempotência.
   * Se um arquivo idêntico (mesmo checksum SHA-256) já foi importado com sucesso (COMPLETED),
   * não cria um job duplicado a menos que seja forçado (force: true).
   */
  static async createJob(params: {
    sourceId: string;
    datasetId?: string;
    rawFilePath: string;
    originalFilename: string;
    checksum: string;
    fileSize: number;
    stateCode?: string;
    period?: string;
    acquisitionMethod?: string;
    originUrl?: string;
    parserUsed?: string;
    parserVersion?: string;
    qualityStatus?: string;
    sourceType?: string;
    environment?: string;
    isOfficialPublication?: boolean;
    isEligibleForProductionAutomation?: boolean;
    force?: boolean;
  }): Promise<CreateJobResult> {
    if (!params.force && params.checksum) {
      const existing = await db
        .select()
        .from(dataImports)
        .where(
          and(
            eq(dataImports.checksum, params.checksum),
            eq(dataImports.status, 'COMPLETED')
          )
        );

      if (existing.length > 0) {
        console.log(`[JobManager] Arquivo duplicado detectado (checksum: ${params.checksum}). Reutilizando Job concluído: ${existing[0].id}`);
        return {
          jobId: existing[0].id,
          isDuplicate: true,
          status: 'COMPLETED'
        };
      }
    }

    const jobId = crypto.randomUUID();
    
    await db.insert(dataImports).values({
      id: jobId,
      sourceId: params.sourceId,
      datasetId: params.datasetId || 'unknown',
      rawFilePath: params.rawFilePath,
      originalFilename: params.originalFilename,
      checksum: params.checksum,
      fileSize: params.fileSize,
      stateCode: params.stateCode || null,
      period: params.period || null,
      acquisitionMethod: params.acquisitionMethod || 'MANUAL_UPLOAD',
      originUrl: params.originUrl || null,
      sourceType: params.sourceType || 'official_download',
      environment: params.environment || 'production',
      isOfficialPublication: params.isOfficialPublication ?? true,
      isEligibleForProductionAutomation: params.isEligibleForProductionAutomation ?? true,
      parserUsed: params.parserUsed || null,
      parserVersion: params.parserVersion || null,
      qualityStatus: params.qualityStatus || 'PENDING',
      status: 'pending',
      attempts: 0,
      recordsRead: 0,
      recordsValid: 0,
      recordsInvalid: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsDuplicate: 0,
      recordsWithoutCoordinates: 0,
      recordsWithInvalidCoordinates: 0,
      recordsWithUnknownMunicipality: 0,
      createdAt: new Date()
    });
    
    return {
      jobId,
      isDuplicate: false,
      status: 'pending'
    };
  }
  
  static async getJob(jobId: string) {
    const jobs = await db.select().from(dataImports).where(eq(dataImports.id, jobId));
    return jobs[0] || null;
  }
  
  static async updateJobStatus(jobId: string, status: string, updates: Partial<typeof dataImports.$inferInsert> = {}) {
    await db.update(dataImports)
      .set({ status, ...updates })
      .where(eq(dataImports.id, jobId));
  }

  /**
   * Reprocessamento oficial de um Job existente.
   * Reseta status para QUEUED, zera contadores e erros, permitindo re-execução segura pelo Worker.
   */
  static async reprocessJob(jobId: string): Promise<{ success: boolean; jobId: string; job?: any; error?: string }> {
    const job = await this.getJob(jobId);
    if (!job) {
      return { success: false, jobId, error: `Job ${jobId} não encontrado` };
    }

    await db.update(dataImports)
      .set({
        status: 'QUEUED',
        attempts: 0,
        checkpoint: '0',
        lastError: null,
        failedAt: null,
        startedAt: null,
        finishedAt: null,
        workerId: null,
        lockedAt: null,
        recordsRead: 0,
        recordsValid: 0,
        recordsInvalid: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsDuplicate: 0,
        recordsWithoutCoordinates: 0,
        recordsWithInvalidCoordinates: 0,
        recordsWithUnknownMunicipality: 0
      })
      .where(eq(dataImports.id, jobId));

    console.log(`[JobManager] Job ${jobId} reinserido na fila para reprocessamento.`);
    const updated = await this.getJob(jobId);
    return { success: true, jobId, job: updated };
  }
}

