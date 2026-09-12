import { rawStorage } from '../pipeline/Storage.js';
import { JobManager } from '../pipeline/JobManager.js';
import crypto from 'crypto';
import { db } from '../../db/index.js';
import { sourceRegistry } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export class SinespDownloader {
  private readonly pageUrl = 'https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/dados-nacionais-1/base-de-dados-e-notas-metodologicas-dos-gestores-estaduais-sinesp-vde-2022-e-2023';
  
  async run() {
    console.log('[SINESP Downloader] Iniciando varredura da página oficial (Gov.br CMS)...');
    const res = await fetch(this.pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (!res.ok) {
      throw new Error(`Falha ao acessar página SINESP: HTTP ${res.status}`);
    }
    
    const html = await res.text();
    const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    const dataLinks = links.filter(l => l.includes('bancovde-') && l.endsWith('/@@download/file'));
    
    if (dataLinks.length === 0) {
      console.log('[SINESP Downloader] Nenhum arquivo SINESP (.xlsx) encontrado na página.');
      return;
    }
    
    // De-duplicate links (sometimes Gov.br CMS puts them multiple times)
    const uniqueLinks = [...new Set(dataLinks)];
    console.log(`[SINESP Downloader] Encontrados ${uniqueLinks.length} links de arquivos SINESP.`);
    
    let downloadedCount = 0;
    
    // Process top 3 most recent to avoid massive downloads during test
    for (const downloadUrl of uniqueLinks.slice(0, 3)) {
      console.log(`[SINESP Downloader] Verificando arquivo: ${downloadUrl}`);
      
      const fileRes = await fetch(downloadUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      if (!fileRes.ok) {
        console.log(`[SINESP Downloader] ERRO: HTTP ${fileRes.status} ao baixar ${downloadUrl}`);
        continue;
      }
      
      const buffer = await fileRes.arrayBuffer();
      const checksum = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
      const size = buffer.byteLength;
      
      // Extract a meaningful filename from URL, e.g., bancovde-2026.xlsx
      const filenameMatch = downloadUrl.match(/bancovde-\d{4}\.xlsx/i);
      const originalFilename = filenameMatch ? filenameMatch[0] : 'sinesp_data.xlsx';
      
      // Store in RAW Storage
      console.log(`[SINESP Downloader] Salvando arquivo de ${size} bytes no RAW Storage (SHA-256: ${checksum})`);
      const { path: rawFilePath } = await rawStorage.put('SINESP', 'v1', originalFilename, Buffer.from(buffer));
      
      // Create Job
      console.log(`[SINESP Downloader] Criando Job no JobManager...`);
      const jobResult = await JobManager.createJob({
        sourceId: 'SINESP',
        datasetId: 'sinesp-vde',
        rawFilePath,
        originalFilename,
        checksum,
        fileSize: size,
        stateCode: 'BR', // National dataset
        acquisitionMethod: 'automatic',
        originUrl: downloadUrl,
        parserUsed: 'SinespParser',
        qualityStatus: 'PENDING',
        sourceType: 'official_download',
        environment: 'production',
        isOfficialPublication: true,
        isEligibleForProductionAutomation: true
      });
      
      if (jobResult.isDuplicate) {
        console.log(`[SINESP Downloader] Arquivo ignorado, checksum duplicado (JobId: ${jobResult.jobId})`);
      } else {
        console.log(`[SINESP Downloader] Novo arquivo registrado com sucesso. JobId: ${jobResult.jobId}`);
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
          .where(eq(sourceRegistry.institution, 'Ministério da Justiça e Segurança Pública (MJSP)'));
      }
    }
    
    console.log(`[SINESP Downloader] Varredura concluída. ${downloadedCount} novos arquivos baixados.`);
  }
}
