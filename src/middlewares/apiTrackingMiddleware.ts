import { Request, Response, NextFunction } from 'express';
import apiTrackingService from '../services/apiTrackingService';

/**
 * Middleware for tracking API requests in real-time
 */
export const apiTrackingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Skip tracking for static files and the dashboard itself
  if (req.path.startsWith('/dashboard') || 
      req.path.includes('.') || 
      req.path === '/socket.io/') {
    return next();
  }
  
  // Start tracking time
  const startTime = process.hrtime();
  
  // Track the request
  const requestId = apiTrackingService.trackRequest(req);
  
  // Store requestId in res.locals for later use
  res.locals.requestId = requestId;
  
  // Track response using 'on-finished' package instead of overriding res.end
  // This avoids TypeScript issues with method overriding
  const onFinished = require('on-finished');
  onFinished(res, () => {
    // Calculate response time
    const hrDuration = process.hrtime(startTime);
    const responseTimeMs = hrDuration[0] * 1000 + hrDuration[1] / 1000000;
    
    // Track the response
    apiTrackingService.trackResponse(requestId, res, responseTimeMs);
  });
  
  next();
};

export default apiTrackingMiddleware; 