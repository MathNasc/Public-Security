/**
 * RobustDownloader.ts
 * Módulo industrial de download e validação rigorosa de fontes oficiais de dados.
 * Valida além do HTTP 200: magic bytes, detecção de páginas HTML de erro, SSRF, checksums e timeouts.
 */

import axios, { AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { IngestionOperationalError } from '../core/contracts/OperationalErrors.js';

export interface DownloadOptions {
  url: string;
  sourceId?: string;
  stateCode?: string;
  datasetId?: string;
  destinationPath?: string;
  timeoutMs?: number;
  maxSizeBytes?: number;
  etag?: string;
  lastModified?: string;
  expectedFormat?: 'csv' | 'xlsx' | 'zip' | 'json' | 'unknown';
  userAgent?: string;
  allowRedirects?: boolean;
}

export interface DownloadResult {
  success: boolean;
  statusCode: number;
  isUnchanged: boolean;
  effectiveUrl: string;
  durationMs: number;
  bytesReceived: number;
  checksum: string;
  contentType: string;
  etag?: string;
  lastModified?: string;
  filePath?: string;
  buffer?: Buffer;
  formatDetected: string;
}

export class RobustDownloader {
  public static readonly DEFAULT_TIMEOUT_MS = 30000;
  public static readonly DEFAULT_MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
  public static readonly DEFAULT_USER_AGENT = 'SecurityRadar-IngestionBot/2.0 (+https://seguranca.gov.br/transparencia)';

  /**
   * Valida se a URL é segura e válida (Prevenção contra SSRF e esquemas perigosos).
   */
  public static validateUrl(rawUrl: string): { valid: boolean; error?: string } {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, error: `Protocolo não permitido: '${parsed.protocol}'. Apenas HTTP e HTTPS são suportados.` };
      }

      const hostname = parsed.hostname.toLowerCase();
      // Bloqueia tentativas de loopback ou metadata cloud em URLs de fontes públicas
      const blockedHosts = ['169.254.169.254', 'metadata.google.internal', 'localhost', '127.0.0.1', '::1'];
      if (blockedHosts.includes(hostname) && process.env.NODE_ENV === 'production') {
        return { valid: false, error: `Host '${hostname}' bloqueado por política de segurança SSRF.` };
      }

      return { valid: true };
    } catch (e: any) {
      return { valid: false, error: `URL inválida: ${e.message}` };
    }
  }

  /**
   * Inspeciona os primeiros bytes (magic bytes) para identificar o formato real do arquivo.
   */
  public static detectContentType(buffer: Buffer): { format: string; isHtml: boolean; isZipOrXlsx: boolean; isCsvOrText: boolean } {
    if (!buffer || buffer.length === 0) {
      return { format: 'empty', isHtml: false, isZipOrXlsx: false, isCsvOrText: false };
    }

    // Checa assinatura ZIP / XLSX (PK\x03\x04 ou PK\x05\x06)
    const isZipOrXlsx = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && (buffer[2] === 0x03 || buffer[2] === 0x05);

    // Checa se é HTML ou XML (tags HTML/DOCTYPE no início)
    const prefix = buffer.slice(0, 1024).toString('utf8').trim().toLowerCase();
    const isHtml = prefix.startsWith('<!doctype html') ||
                   prefix.startsWith('<html') ||
                   prefix.includes('<head>') ||
                   prefix.includes('<body>') ||
                   prefix.includes('access denied') ||
                   prefix.includes('cloudflare') ||
                   prefix.includes('404 not found');

    let format = 'unknown';
    if (isZipOrXlsx) format = 'xlsx/zip';
    else if (isHtml) format = 'html';
    else format = 'csv/text';

    return {
      format,
      isHtml,
      isZipOrXlsx,
      isCsvOrText: !isHtml && !isZipOrXlsx
    };
  }

  /**
   * Executa o download com validação completa de status HTTP, headers, bytes recebidos e integridade.
   */
  public static async download(options: DownloadOptions): Promise<DownloadResult> {
    const startTime = Date.now();
    const urlValidation = this.validateUrl(options.url);
    if (!urlValidation.valid) {
      throw new IngestionOperationalError({
        code: 'security_violation_error',
        message: `Falha de validação de URL: ${urlValidation.error}`,
        sourceId: options.sourceId,
        stateCode: options.stateCode,
        datasetId: options.datasetId,
        url: options.url,
        fatal: true
      });
    }

    const timeout = options.timeoutMs || this.DEFAULT_TIMEOUT_MS;
    const maxSizeBytes = options.maxSizeBytes || this.DEFAULT_MAX_SIZE_BYTES;
    const userAgent = options.userAgent || this.DEFAULT_USER_AGENT;

    const headers: Record<string, string> = {
      'User-Agent': userAgent,
      'Accept': 'text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/zip, text/plain, */*'
    };

    if (options.etag) {
      headers['If-None-Match'] = options.etag;
    }
    if (options.lastModified) {
      headers['If-Modified-Since'] = options.lastModified;
    }

    const config: AxiosRequestConfig = {
      url: options.url,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout,
      maxContentLength: maxSizeBytes,
      maxBodyLength: maxSizeBytes,
      headers,
      validateStatus: (status) => status < 500 // Trata 304, 403, 404, etc. de forma controlada
    };

    let response;
    try {
      response = await axios(config);
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout');
      
      throw new IngestionOperationalError({
        code: isTimeout ? 'network_error' : 'http_error',
        message: `Falha de rede/transporte ao conectar com '${options.url}': ${err.message}`,
        sourceId: options.sourceId,
        stateCode: options.stateCode,
        datasetId: options.datasetId,
        url: options.url,
        durationMs,
        fatal: true,
        context: { errorCode: err.code }
      });
    }

    const durationMs = Date.now() - startTime;
    const statusCode = response.status;
    const contentTypeHeader = (response.headers['content-type'] || '').toLowerCase();
    const effectiveUrl = response.request?.res?.responseUrl || options.url;
    const resEtag = response.headers['etag'];
    const resLastModified = response.headers['last-modified'];

    // Tratamento de HTTP 304 Not Modified (Sem alteração no servidor)
    if (statusCode === 304) {
      return {
        success: true,
        statusCode: 304,
        isUnchanged: true,
        effectiveUrl,
        durationMs,
        bytesReceived: 0,
        checksum: options.etag || '',
        contentType: contentTypeHeader,
        etag: resEtag,
        lastModified: resLastModified,
        formatDetected: 'unchanged'
      };
    }

    // Tratamento de HTTP de Erro (403, 404, 429, etc.)
    if (statusCode >= 400) {
      throw new IngestionOperationalError({
        code: 'http_error',
        message: `Fonte retornou status HTTP ${statusCode} (${response.statusText || 'Erro'}). Acesso negado ou recurso indisponível.`,
        sourceId: options.sourceId,
        stateCode: options.stateCode,
        datasetId: options.datasetId,
        url: options.url,
        httpStatus: statusCode,
        durationMs,
        fatal: true
      });
    }

    const buffer = Buffer.from(response.data);
    const bytesReceived = buffer.length;

    // Validação 1: Arquivo Vazio (0 bytes)
    if (bytesReceived === 0) {
      throw new IngestionOperationalError({
        code: 'content_validation_error',
        message: `Download retornou arquivo vazio (0 bytes) para a URL '${options.url}'.`,
        sourceId: options.sourceId,
        stateCode: options.stateCode,
        datasetId: options.datasetId,
        url: options.url,
        httpStatus: statusCode,
        durationMs,
        bytesReceived: 0,
        fatal: true
      });
    }

    // Validação 2: Detecção de Magic Bytes e HTML retornado com HTTP 200
    const detected = this.detectContentType(buffer);
    if (detected.isHtml && options.expectedFormat !== 'unknown' && options.expectedFormat !== 'json') {
      throw new IngestionOperationalError({
        code: 'content_validation_error',
        message: `Fonte retornou HTTP ${statusCode}, porém o payload é uma página HTML de erro/portal, e não o arquivo de dados esperado (${options.expectedFormat || 'tabela'}).`,
        sourceId: options.sourceId,
        stateCode: options.stateCode,
        datasetId: options.datasetId,
        url: options.url,
        httpStatus: statusCode,
        durationMs,
        bytesReceived,
        fatal: true,
        context: { detectedFormat: detected.format }
      });
    }

    // Validação 3: Formato XLSX esperado mas magic bytes não batem
    if (options.expectedFormat === 'xlsx' && !detected.isZipOrXlsx) {
      throw new IngestionOperationalError({
        code: 'content_validation_error',
        message: `Arquivo baixado não possui assinatura válida de planilha XLSX/ZIP (Magic bytes inválidos).`,
        sourceId: options.sourceId,
        stateCode: options.stateCode,
        datasetId: options.datasetId,
        url: options.url,
        httpStatus: statusCode,
        durationMs,
        bytesReceived,
        fatal: true
      });
    }

    // Cálculo do Hash SHA-256
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // Gravação em disco se destinationPath foi especificado
    let finalPath: string | undefined;
    if (options.destinationPath) {
      const resolved = path.isAbsolute(options.destinationPath)
        ? options.destinationPath
        : path.join(process.cwd(), options.destinationPath);

      const dir = path.dirname(resolved);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(resolved, buffer);
      finalPath = resolved;
    }

    return {
      success: true,
      statusCode,
      isUnchanged: false,
      effectiveUrl,
      durationMs,
      bytesReceived,
      checksum,
      contentType: contentTypeHeader,
      etag: resEtag,
      lastModified: resLastModified,
      filePath: finalPath,
      buffer,
      formatDetected: detected.format
    };
  }
}
