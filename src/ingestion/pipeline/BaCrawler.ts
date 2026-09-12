import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../../db/index.js';
import { dataImports } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export class BaCrawler {
  private readonly baseUrl = 'https://www.ba.gov.br';
  private readonly rootUrl = 'https://www.ba.gov.br/ssp/estatistica';
  private readonly rawStorageDir = path.join(process.cwd(), 'raw_storage', 'ssp_ba');

  constructor() {
    if (!fs.existsSync(this.rawStorageDir)) {
      fs.mkdirSync(this.rawStorageDir, { recursive: true });
    }
  }

  async run(): Promise<void> {
    console.log('[BaCrawler] Iniciando automação para a Bahia...');
    try {
      const html = await this.fetchHtml(this.rootUrl);
      const yearLinks = this.extractLinks(html, /href="(\/ssp\/publicacoes\?combine=202[0-9][^"]*)"/g);
      
      console.log(`[BaCrawler] Encontrados ${yearLinks.length} anos para verificar.`);
      
      const targetYears = yearLinks.slice(0, 2); 

      for (const yLink of targetYears) {
        console.log(`[BaCrawler] Explorando ano: ${yLink}`);
        const yearHtml = await this.fetchHtml(this.baseUrl + yLink.replace(/&amp;/g, '&'));
        
        const nodeLinks = this.extractLinks(yearHtml, /href="(\/ssp\/node\/\d+)"/g);
        
        for (const node of nodeLinks) {
           const nodeHtml = await this.fetchHtml(this.baseUrl + node);
           const fileLinks = this.extractLinks(nodeHtml, /href="([^"]+\.(csv|xlsx|xls))"/gi);
           
           for (const fileUrl of fileLinks.slice(0,1)) {
              const fullUrl = fileUrl.startsWith('http') ? fileUrl : this.baseUrl + fileUrl;
              await this.downloadAndRegisterFile(fullUrl);
           }
        }
      }
      console.log('[BaCrawler] Ciclo de descoberta concluído com sucesso.');
    } catch (e) {
      console.error('[BaCrawler] Falha na automação da Bahia:', e);
    }
  }

  private async fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, {
       headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ao acessar ${url}`);
    return res.text();
  }

  private extractLinks(html: string, regex: RegExp): string[] {
    const matches = [...html.matchAll(regex)];
    const unique = [...new Set(matches.map(m => m[1]))];
    return unique;
  }

  private async downloadAndRegisterFile(fileUrl: string) {
    console.log(`[BaCrawler] Baixando: ${fileUrl}`);
    const res = await fetch(fileUrl, {
       headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!res.ok) {
       console.log(`[BaCrawler] Erro ao baixar arquivo: HTTP ${res.status}`);
       return;
    }
    
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const existing = await db.select().from(dataImports).where(eq(dataImports.checksum, hash)).limit(1);
    
    if (existing.length > 0) {
      console.log(`[BaCrawler] Arquivo já importado anteriormente (hash: ${hash}). Ignorando.`);
      return;
    }

    const fileName = path.basename(new URL(fileUrl).pathname);
    const dateFolder = new Date().toISOString().substring(0, 7);
    const targetDir = path.join(this.rawStorageDir, dateFolder);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    
    const filePath = path.join(targetDir, fileName);
    fs.writeFileSync(filePath, buffer);
    console.log(`[BaCrawler] Arquivo salvo em: ${filePath}`);

    const jobId = crypto.randomUUID();
    await db.insert(dataImports).values({
      id: jobId,
      sourceId: 'SSP-BA',
      datasetId: 'indicadores_seguranca_ba',
      rawFilePath: filePath,
      originalFilename: fileName,
      fileSize: buffer.length,
      status: 'pending',
      recordsProcessed: 0,
      checksum: hash,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`[BaCrawler] Novo Job ${jobId} registrado com sucesso para processamento.`);
  }
}
