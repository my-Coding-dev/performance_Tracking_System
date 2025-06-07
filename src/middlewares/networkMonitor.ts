import { Request, Response, NextFunction } from 'express';
import logger, { NetworkLogEntry } from '../utils/logger';
import config from '../config/config';
import { UAParser } from 'ua-parser-js';
import onHeaders from 'on-headers';
import onFinished from 'on-finished';

/**
 * Calculate size of request in bytes
 */
const calculateRequestSize = (req: Request): number => {
  let size = 0;
  
  // Headers
  size += Buffer.byteLength(JSON.stringify(req.headers || {}));
  
  // Method and URL
  size += Buffer.byteLength(req.method + ' ' + req.url);
  
  // Body
  if (req.body) {
    size += Buffer.byteLength(JSON.stringify(req.body));
  }
  
  return size;
};

/**
 * Parse user agent to get platform information
 */
const parsePlatformInfo = (userAgent: string | undefined): NetworkLogEntry['platformInfo'] => {
  if (!userAgent) return undefined;
  
  const parser = new UAParser(userAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();
  
  return {
    browser: browser.name,
    browserVersion: browser.version,
    os: os.name,
    osVersion: os.version,
    device: device.vendor ? `${device.vendor} ${device.model}`.trim() : undefined,
    mobile: device.type === 'mobile' || device.type === 'tablet'
  };
};

/**
 * Middleware for monitoring network requests and responses
 */
export const networkMonitor = (req: Request, res: Response, next: NextFunction): void => {
  if (!config.networkMonitor.enabled) {
    return next();
  }
  
  // Start time
  const startTime = process.hrtime();
  const requestSize = calculateRequestSize(req);
  
  // Set headers before they're sent
  onHeaders(res, () => {
    try {
      // Add cache-control headers if not set
      if (!res.getHeader('Cache-Control') && req.method === 'GET') {
        const url = req.url || '';
        if (/\.(jpg|jpeg|gif|png|ico|css|js|svg|woff|woff2|ttf|eot)(\?.*)?$/.test(url)) {
          res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
        } else {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
      
      // Add performance metrics headers in development
      if (config.nodeEnv === 'development') {
        const hrDuration = process.hrtime(startTime);
        const responseTimeMs = hrDuration[0] * 1000 + hrDuration[1] / 1000000;
        res.setHeader('X-Response-Time', `${responseTimeMs.toFixed(2)}ms`);
        res.setHeader('X-Request-Size', `${requestSize} bytes`);
      }
    } catch (error) {
      // Log error but don't fail the request
      logger.error('Error setting response headers', error instanceof Error ? error : new Error(String(error)));
    }
  });
  
  // Process when response is finished (for logging only)
  onFinished(res, () => {
    try {
      // Calculate response time
      const hrDuration = process.hrtime(startTime);
      const responseTimeMs = hrDuration[0] * 1000 + hrDuration[1] / 1000000;
      
      // Extract referrer from headers
      const referrerHeader = req.headers.referer || req.headers.referrer;
      const referrer = Array.isArray(referrerHeader) ? referrerHeader[0] : referrerHeader;
      
      // Create log entry
      const networkLog: NetworkLogEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        responseTimeMs,
        requestSizeBytes: requestSize,
        // Response size tracking is disabled to avoid TypeScript issues
        userAgent: req.headers['user-agent'] as string | undefined,
        ipAddress: req.ip || req.socket.remoteAddress,
        protocol: req.protocol,
        referrer,
        contentType: res.getHeader('content-type') as string,
        platformInfo: parsePlatformInfo(req.headers['user-agent'] as string)
      };
      
      // Log the request
      logger.logNetworkRequest(networkLog);
    } catch (error) {
      // Just log the error and continue
      logger.error('Error logging network request', error instanceof Error ? error : new Error(String(error)));
    }
  });
  
  next();
};

export default networkMonitor; 