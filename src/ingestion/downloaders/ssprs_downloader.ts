import { rawStorage } from '../pipeline/Storage.js';
import { JobManager } from '../pipeline/JobManager.js';
import crypto from 'crypto';
import { db } from '../../db/index.js';
import { sourceRegistry } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export class SspRsDownloader {
  private readonly baseUrl = 'https://www.ssp.rs.gov.br';
  private readonly pageUrl = 'https://www.ssp.rs.gov.br/dados-abertos';
  
  async run() {
    console.log('[SSP-RS Downloader] Iniciando varredura da página oficial...');
    const res = await fetch(this.pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Public Security Bot)' } });
    if (!res.ok) {
      throw new Error(`Falha ao acessar página SSP-RS: HTTP ${res.status}`);
    }
    
    const html = await res.text();
    const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    const zipLinks = links.filter(l => l.includes('.zip'));
    
    if (zipLinks.length === 0) {
      console.log('[SSP-RS Downloader] Nenhum arquivo ZIP encontrado na página.');
      return;
    }
    
    console.log(`[SSP-RS Downloader] Encontrados ${zipLinks.length} links de arquivos ZIP.`);
    
    // Process only the first one (most recent usually) or all of them
    // The prompt says "baixar apenas arquivos novos; evitar downloads duplicados"
    // Let's iterate through the top 3 most recent ones (for safety, avoiding downloading all 15 every time if they exist)
    
    let downloadedCount = 0;
    
    for (const link of zipLinks.slice(0, 3)) {
      const downloadUrl = link.startsWith('http') ? link : `${this.baseUrl}${link}`;
      console.log(`[SSP-RS Downloader] Verificando arquivo: ${downloadUrl}`);
      
      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) {
        console.log(`[SSP-RS Downloader] ERRO: HTTP ${fileRes.status} ao baixar ${downloadUrl}`);
        continue;
      }
      
      const buffer = await fileRes.arrayBuffer();
      const checksum = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
      
      const size = buffer.byteLength;
      const originalFilename = downloadUrl.split('/').pop() || 'ssprs_data.zip';
      
      // Store in RAW Storage
      console.log(`[SSP-RS Downloader] Salvando arquivo de ${size} bytes no RAW Storage (SHA-256: ${checksum})`);
      const { path: rawFilePath, metadata } = await rawStorage.put('SSP-RS', 'v1', originalFilename, Buffer.from(buffer));
      
      // Create Job
      console.log(`[SSP-RS Downloader] Criando Job no JobManager...`);
      const jobResult = await JobManager.createJob({
        sourceId: 'SSP-RS',
        datasetId: 'ssprs-abertos',
        rawFilePath,
        originalFilename,
        checksum,
        fileSize: size,
        stateCode: 'RS',
        acquisitionMethod: 'automatic',
        originUrl: downloadUrl,
        parserUsed: 'SspRsZipParser',
        qualityStatus: 'PENDING'
      });
      
      if (jobResult.isDuplicate) {
        console.log(`[SSP-RS Downloader] Arquivo ignorado, checksum duplicado (JobId: ${jobResult.jobId})`);
      } else {
        console.log(`[SSP-RS Downloader] Novo arquivo registrado com sucesso. JobId: ${jobResult.jobId}`);
        downloadedCount++;
        
        // Update Registry
        await db.update(sourceRegistry)
          .set({
             lastSuccessfulDownloadAt: new Date(),
             lastDownloadedHash: checksum,
             lastDownloadedSize: size,
             status: 'downloadable',
             evidenceLevel: 'E5'
          })
          .where(eq(sourceRegistry.institution, 'Secretaria de Segurança Pública do Rio Grande do Sul (SSP-RS)'));
      }
    }
    
    console.log(`[SSP-RS Downloader] Varredura concluída. ${downloadedCount} novos arquivos baixados.`);
  }
}
