import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger.js';
import { metricsCollector } from '../lib/metrics.js';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-correlation-id'] || req.headers['x-request-id'] || uuidv4()) as string;
  req.headers['x-correlation-id'] = correlationId;
  req.headers['x-request-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('x-request-id', correlationId);

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Feed observability metrics collector
    metricsCollector.recordRequest(req.method, req.originalUrl, res.statusCode, duration);

    // Structured JSON log
    logger.info('HTTP Request', {
      event: 'http_request',
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration_ms: duration,
      correlation_id: correlationId,
      request_id: correlationId,
      user_agent: req.headers['user-agent'] || 'unknown',
      ip: req.ip
    });
  });

  next();
};
