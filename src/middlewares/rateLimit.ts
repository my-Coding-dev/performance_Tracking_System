import rateLimit from 'express-rate-limit';
import config from '../config/config';
import logger from '../utils/logger';

/**
 * Rate limiting middleware configuration
 */
export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimiting.windowMs,
  max: config.rateLimiting.maxRequests,
  standardHeaders: config.rateLimiting.standardHeaders,
  legacyHeaders: config.rateLimiting.legacyHeaders,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.'
  },
  keyGenerator: (req) => {
    // Use IP address as default
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
    // For authenticated requests, can use user ID for more granular control
    // const userId = req.user?.id;
    // return userId ? `${userId}:${ip}` : ip;
    
    return ip;
  },
  // Function to determine if request counts towards rate limiting
  // Can be used to implement different limits for different routes/methods
  skip: (req) => {
    // Don't rate limit health checks and static resources
    return req.path.startsWith('/api/health') || 
           req.path.includes('/static/') ||
           req.path.endsWith('.ico') ||
           req.path.endsWith('.png') ||
           req.path.endsWith('.jpg');
  },
  // Handler called when rate limiter triggered
  handler: (req, res, _next, options) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent']
    });
    
    res.status(429).json(options.message);
  }
});

// More strict rate limiting for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many login attempts, please try again later.'
  },
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
  handler: (req, res, _next, options) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    
    res.status(429).json(options.message);
  }
});

export default { apiRateLimiter, authRateLimiter }; 