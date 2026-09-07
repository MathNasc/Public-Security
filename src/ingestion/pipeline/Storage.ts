import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { pipeline } from 'stream/promises';

export interface RawFileMetadata {
  filename: string;
  size: number;
  checksum: string; // SHA-256
  createdAt: Date;
}

export class RawStorage {
  private baseDir: string;

  constructor(baseDir: string = path.join(process.cwd(), 'raw_storage')) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getFilePath(datasetId: string, version: string, originalFilename: string) {
    const dir = path.join(this.baseDir, datasetId, version);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, originalFilename);
  }

  async put(datasetId: string, version: string, originalFilename: string, sourceStream: NodeJS.ReadableStream): Promise<{ path: string, metadata: RawFileMetadata }> {
    const targetPath = this.getFilePath(datasetId, version, originalFilename);
    const hash = crypto.createHash('sha256');
    let size = 0;

    const writeStream = fs.createWriteStream(targetPath);
    
    // We can compute hash and size while piping
    sourceStream.on('data', (chunk) => {
      hash.update(chunk);
      size += chunk.length;
    });

    await pipeline(sourceStream, writeStream);

    return {
      path: targetPath,
      metadata: {
        filename: originalFilename,
        size,
        checksum: hash.digest('hex'),
        createdAt: new Date()
      }
    };
  }

  get(storedPath: string): NodeJS.ReadableStream {
    if (!fs.existsSync(storedPath)) {
      throw new Error(`File not found in RawStorage: ${storedPath}`);
    }
    return fs.createReadStream(storedPath);
  }

  exists(storedPath: string): boolean {
    return fs.existsSync(storedPath);
  }

  delete(storedPath: string): void {
    if (fs.existsSync(storedPath)) {
      fs.unlinkSync(storedPath);
    }
  }
}

export const rawStorage = new RawStorage();
