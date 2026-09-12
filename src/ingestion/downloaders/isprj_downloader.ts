import { rawStorage } from '../pipeline/Storage.js';
import { JobManager } from '../pipeline/JobManager.js';
import crypto from 'crypto';
import { db } from '../../db/index.js';
import { sourceRegistry } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export class IspRjDownloader {
  private readonly baseUrl = 'https://www.ispdados.rj.gov.br';
  private readonly pageUrl = 'https://www.ispdados.rj.gov.br/estatistica.html';
  
  async run() {
    console.log('[ISP-RJ Downloader] Iniciando varredura da página oficial ISP Dados...');
    const res = await fetch(this.pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) {
      throw new Error(`Falha ao acessar página ISP-RJ: HTTP ${res.status}`);
    }
    
    const html = await res.text();
    const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    const dataLinks = links.filter(l => l.includes('.csv') || l.includes('.xlsx'));
    
    if (dataLinks.length === 0) {
      console.log('[ISP-RJ Downloader] Nenhum arquivo CSV/XLSX encontrado na página.');
      return;
    }
    
    const uniqueLinks = [...new Set(dataLinks)];
    console.log(`[ISP-RJ Downloader] Encontrados ${uniqueLinks.length} links de arquivos ISP-RJ.`);
    
    let downloadedCount = 0;
    
    // We only want 1 or 2 important datasets for the prototype to avoid huge downloads.
    // BaseMunicipioMensal is usually the best one for RJ.
    const priorityLinks = uniqueLinks.filter(l => l.includes('BaseMunicipioMensal.csv') || l.includes('BaseDPEvolucaoMensalCisp.csv'));
    const targetLinks = priorityLinks.length > 0 ? priorityLinks : uniqueLinks.slice(0, 3);

    for (const link of targetLinks) {
      const downloadUrl = link.startsWith('http') ? link : `${this.baseUrl}/${link}`;
      console.log(`[ISP-RJ Downloader] Verificando arquivo: ${downloadUrl}`);
      
      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) {
        console.log(`[ISP-RJ Downloader] ERRO: HTTP ${fileRes.status} ao baixar ${downloadUrl}`);
        continue;
      }
      
      const buffer = await fileRes.arrayBuffer();
      const checksum = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
      const size = buffer.byteLength;
      const originalFilename = downloadUrl.split('/').pop() || 'isprj_data.csv';
      
      console.log(`[ISP-RJ Downloader] Salvando arquivo de ${size} bytes no RAW Storage (SHA-256: ${checksum})`);
      const { path: rawFilePath } = await rawStorage.put('ISP-RJ', 'v1', originalFilename, Buffer.from(buffer));
      
      console.log(`[ISP-RJ Downloader] Criando Job no JobManager...`);
      const jobResult = await JobManager.createJob({
        sourceId: 'ISP-RJ',
        datasetId: 'isprj-estatisticas',
        rawFilePath,
        originalFilename,
        checksum,
        fileSize: size,
        stateCode: 'RJ',
        acquisitionMethod: 'automatic',
        originUrl: downloadUrl,
        parserUsed: 'IspRjParser',
        qualityStatus: 'PENDING',
        sourceType: 'official_download',
        environment: 'production',
        isOfficialPublication: true,
        isEligibleForProductionAutomation: true
      });
      
      if (jobResult.isDuplicate) {
        console.log(`[ISP-RJ Downloader] Arquivo ignorado, checksum duplicado (JobId: ${jobResult.jobId})`);
      } else {
        console.log(`[ISP-RJ Downloader] Novo arquivo registrado com sucesso. JobId: ${jobResult.jobId}`);
        downloadedCount++;
        
        await db.update(sourceRegistry)
          .set({
             lastSuccessfulDownloadAt: new Date(),
             lastDownloadedHash: checksum,
             lastDownloadedSize: size,
             status: 'downloadable',
             evidenceLevel: 'E5'
          })
          .where(eq(sourceRegistry.institution, 'Instituto de Segurança Pública (ISP-RJ)'));
      }
    }
    
    console.log(`[ISP-RJ Downloader] Varredura concluída. ${downloadedCount} novos arquivos baixados.`);
  }
}
