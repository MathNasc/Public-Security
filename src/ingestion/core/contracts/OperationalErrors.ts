/**
 * OperationalErrors.ts
 * Taxonomia padronizada de erros operacionais do pipeline de ingestão.
 */

export type IngestionErrorCode =
  | 'network_error'
  | 'http_error'
  | 'content_validation_error'
  | 'schema_validation_error'
  | 'parse_error'
  | 'persistence_error'
  | 'reconciliation_error'
  | 'stale_job_error'
  | 'security_violation_error';

export interface OperationalErrorDetails {
  code: IngestionErrorCode;
  message: string;
  sourceId?: string;
  stateCode?: string;
  datasetId?: string;
  url?: string;
  httpStatus?: number;
  durationMs?: number;
  bytesReceived?: number;
  fatal?: boolean;
  context?: Record<string, any>;
}

export class IngestionOperationalError extends Error {
  public readonly code: IngestionErrorCode;
  public readonly sourceId?: string;
  public readonly stateCode?: string;
  public readonly datasetId?: string;
  public readonly url?: string;
  public readonly httpStatus?: number;
  public readonly durationMs?: number;
  public readonly bytesReceived?: number;
  public readonly fatal: boolean;
  public readonly context?: Record<string, any>;
  public readonly timestamp: string;

  constructor(details: OperationalErrorDetails) {
    super(details.message);
    this.name = 'IngestionOperationalError';
    this.code = details.code;
    this.sourceId = details.sourceId;
    this.stateCode = details.stateCode;
    this.datasetId = details.datasetId;
    this.url = details.url;
    this.httpStatus = details.httpStatus;
    this.durationMs = details.durationMs;
    this.bytesReceived = details.bytesReceived;
    this.fatal = details.fatal ?? true;
    this.context = details.context;
    this.timestamp = new Date().toISOString();

    // Mantém stack trace correto em V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IngestionOperationalError);
    }
  }

  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      sourceId: this.sourceId,
      stateCode: this.stateCode,
      datasetId: this.datasetId,
      url: this.url,
      httpStatus: this.httpStatus,
      durationMs: this.durationMs,
      bytesReceived: this.bytesReceived,
      fatal: this.fatal,
      context: this.context,
      timestamp: this.timestamp
    };
  }
}
