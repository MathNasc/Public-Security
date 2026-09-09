import { db } from '../../db/index.js';
import { dataImports } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export class JobManager {
  
  static async createJob(params: {
    sourceId: string;
    datasetId?: string;
    rawFilePath: string;
    originalFilename: string;
    checksum: string;
    fileSize: number;
  }) {
    const jobId = crypto.randomUUID();
    
    await db.insert(dataImports).values({
      id: jobId,
      sourceId: params.sourceId,
      datasetId: params.datasetId || 'unknown',
      rawFilePath: params.rawFilePath,
      originalFilename: params.originalFilename,
      checksum: params.checksum,
      fileSize: params.fileSize,
      status: 'QUEUED',
      attempts: 0,
    });
    
    return jobId;
  }
  
  static async getJob(jobId: string) {
    const jobs = await db.select().from(dataImports).where(eq(dataImports.id, jobId));
    return jobs[0];
  }
  
  static async updateJobStatus(jobId: string, status: string, updates: Partial<typeof dataImports.$inferInsert> = {}) {
    await db.update(dataImports)
      .set({ status, ...updates, }) // Wait, schema doesn't have updatedAt. Let's omit it or check schema
      .where(eq(dataImports.id, jobId));
  }
}
