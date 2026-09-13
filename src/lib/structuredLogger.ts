/**
 * structuredLogger.ts
 * Logger JSON estruturado e correlacionável para observabilidade em produção.
 * Sanitiza automaticamente segredos, tokens, senhas e URLs de conexão.
 */

export interface LogContext {
  runId?: string;
  jobId?: string;
  provider?: string;
  stateCode?: string;
  sourceId?: string;
  dataset?: string;
  period?: string;
  stage?: string;
  status?: string;
  durationMs?: number;
  recordsRead?: number;
  recordsWritten?: number;
  recordsRejected?: number;
  checksum?: string;
  errorCode?: string;
  [key: string]: any;
}

export class StructuredLogger {
  private static sanitize(obj: any): any {
    if (typeof obj === 'string') {
      // Oculta chaves, tokens e passwords em strings
      return obj
        .replace(/password(=|:)[^&,\s]+/gi, 'password=***')
        .replace(/token(=|:)[^&,\s]+/gi, 'token=***')
        .replace(/key(=|:)[^&,\s]+/gi, 'key=***')
        .replace(/postgres:\/\/[^:]+:[^@]+@/gi, 'postgres://***:***@');
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitize(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized: Record<string, any> = {};
      const sensitiveKeys = ['password', 'secret', 'token', 'apikey', 'authorization', 'cookie', 'pass'];

      for (const [k, v] of Object.entries(obj)) {
        if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk.toLowerCase()))) {
          sanitized[k] = '***';
        } else {
          sanitized[k] = this.sanitize(v);
        }
      }
      return sanitized;
    }

    return obj;
  }

  private static formatLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, context: LogContext = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.sanitize(context)
    };

    const serialized = JSON.stringify(logEntry);
    switch (level) {
      case 'info':
        console.log(serialized);
        break;
      case 'warn':
        console.warn(serialized);
        break;
      case 'error':
        console.error(serialized);
        break;
      case 'debug':
        if (process.env.DEBUG === 'true') {
          console.debug(serialized);
        }
        break;
    }
    return logEntry;
  }

  public static info(message: string, context?: LogContext) {
    return this.formatLog('info', message, context);
  }

  public static warn(message: string, context?: LogContext) {
    return this.formatLog('warn', message, context);
  }

  public static error(message: string, context?: LogContext) {
    return this.formatLog('error', message, context);
  }

  public static debug(message: string, context?: LogContext) {
    return this.formatLog('debug', message, context);
  }
}
