import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['authorization'] || req.headers['x-admin-token'];
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    logger.error('ADMIN_SECRET not configured, admin endpoints disabled', { event: 'admin_auth_failed' });
    return res.status(503).json({ error: 'Admin endpoints disabled (missing config)' });
  }

  if (token !== `Bearer ${adminSecret}` && token !== adminSecret) {
    logger.warn('Unauthorized admin access attempt', {
      event: 'admin_auth_rejected',
      ip: req.ip,
      path: req.originalUrl
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};
