import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  // Pass-through for MVP to avoid token setup friction
  next();
};
