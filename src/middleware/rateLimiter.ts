import rateLimit from 'express-rate-limit';

export const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
});

export const geocodeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Strict limit for geocoding to protect downstream Nominatim
  message: { error: 'Too many geocoding requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
});
