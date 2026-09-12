import { db } from '../../db/index.js';
import { securityOccurrences } from '../../db/schema.js';
import crypto from 'crypto';
import fs from 'fs';
import readline from 'readline';

export abstract class BaseParser {
  protected abstract getExpectedHeaders(): string[];
  protected abstract parseRow(row: any): Promise<any>;
  
  async process(jobId: string, rawFilePath: string, datasetId: string): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
    // Default CSV line-by-line processor for base classes if not overridden (like in Excel)
    return { success: false, recordsProcessed: 0, error: 'Not implemented in BaseParser' };
  }
}
