import { Request, Response, NextFunction } from 'express';
import db from '../utils/database';
import logger from '../utils/logger';

/**
 * Middleware to handle database connections and collect statistics
 */
export const databaseMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Add database stats to response headers in development mode
  if (process.env.NODE_ENV === 'development') {
    const originalSend = res.send;
    
    // Override send method to add headers
    res.send = function(...args): Response {
      try {
        // Get database stats
        const stats = db.getStats();
        
        // Add stats to headers if headers not sent yet
        if (!res.headersSent) {
          res.setHeader('X-DB-Queries', String(stats.queryCount));
          res.setHeader('X-Cache-Hit-Rate', stats.cacheHitRate);
        }
      } catch (error) {
        logger.error('Error adding database stats headers', 
          error instanceof Error ? error : new Error(String(error)));
      }
      
      // Call original send
      return originalSend.apply(res, args);
    };
  }
  
  // Add database instance to request for easy access
  (req as any).db = db;
  
  next();
};

/**
 * Middleware to trace database operations
 */
export const databaseTraceMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Add unique request ID to trace database operations
  const requestId = req.headers['x-request-id'] || 
                    req.headers['x-correlation-id'] || 
                    `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  
  // Add to request context
  (req as any).requestId = requestId;
  
  // Add to response headers
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

/**
 * Generate cache key for a specific request
 */
export const generateCacheKey = (prefix: string, params?: Record<string, any>): string => {
  if (!params) {
    return prefix;
  }
  
  // Create stable cache key by sorting params
  const sortedEntries = Object.entries(params).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  const serialized = sortedEntries.map(([key, value]) => `${key}:${JSON.stringify(value)}`).join('|');
  
  return `${prefix}:${serialized}`;
};

export default { databaseMiddleware, databaseTraceMiddleware, generateCacheKey }; 