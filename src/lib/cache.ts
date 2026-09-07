import { LRUCache } from 'lru-cache';

export const analysisCache = new LRUCache<string, any>({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
});
