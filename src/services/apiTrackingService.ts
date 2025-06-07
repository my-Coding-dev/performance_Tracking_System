import { Request, Response } from 'express';
import logger from '../utils/logger';
import { EventEmitter } from 'events';

// API request details interface
export interface ApiRequestDetails {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  params: Record<string, any>;
  query: Record<string, any>;
  headers: Record<string, string>;
  body: any;
  responseStatus?: number;
  responseTime?: number;
  responseSize?: number;
  ip?: string;
  userAgent?: string;
}

/**
 * Service for tracking API requests in real-time
 */
class ApiTrackingService extends EventEmitter {
  private requests: ApiRequestDetails[] = [];
  private readonly MAX_STORED_REQUESTS = 100; // Limit stored requests to prevent memory issues

  constructor() {
    super();
    logger.info('API Tracking Service initialized');
  }

  /**
   * Track an incoming API request
   */
  public trackRequest(req: Request): string {
    const requestId = this.generateRequestId();
    
    // Create request details object
    const requestDetails: ApiRequestDetails = {
      id: requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl || req.url,
      params: req.params,
      query: req.query,
      headers: this.sanitizeHeaders(req.headers),
      body: this.sanitizeBody(req.body),
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] as string
    };
    
    // Store request
    this.addRequest(requestDetails);
    
    // Emit request event
    this.emit('request', requestDetails);
    
    return requestId;
  }

  /**
   * Update request with response details
   */
  public trackResponse(requestId: string, res: Response, responseTime: number): void {
    // Find request in our tracking array
    const request = this.requests.find(req => req.id === requestId);
    
    if (request) {
      // Update with response details
      request.responseStatus = res.statusCode;
      request.responseTime = responseTime;
      
      // Estimate response size
      try {
        const contentLength = res.getHeader('content-length');
        if (contentLength) {
          request.responseSize = parseInt(contentLength as string, 10);
        }
      } catch (error) {
        // Ignore errors in size calculation
      }
      
      // Emit response event
      this.emit('response', request);
    }
  }

  /**
   * Get recent API requests
   */
  public getRequests(limit: number = 20): ApiRequestDetails[] {
    return this.requests.slice(-limit);
  }

  /**
   * Get a specific request by ID
   */
  public getRequestById(id: string): ApiRequestDetails | undefined {
    return this.requests.find(req => req.id === id);
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Sanitize request headers to remove sensitive information
   */
  private sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      // Skip sensitive headers
      if (['authorization', 'cookie', 'set-cookie'].includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = Array.isArray(value) ? value[0] : String(value);
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize request body to remove sensitive information and limit size
   */
  private sanitizeBody(body: any): any {
    if (!body) return {};
    
    try {
      const sanitized = { ...body };
      
      // Redact common sensitive fields
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
      
      for (const field of sensitiveFields) {
        this.redactSensitiveField(sanitized, field);
      }
      
      // Convert to string and limit size
      const bodyString = JSON.stringify(sanitized);
      if (bodyString.length > 2000) {
        return { __truncated: true, __size: bodyString.length, preview: bodyString.substring(0, 2000) + '...' };
      }
      
      return sanitized;
    } catch (error) {
      // If any error occurs, return a safe object
      return { __error: 'Could not sanitize body' };
    }
  }

  /**
   * Recursively redact sensitive fields
   */
  private redactSensitiveField(obj: any, field: string): void {
    if (typeof obj !== 'object' || obj === null) return;
    
    for (const key of Object.keys(obj)) {
      if (key.toLowerCase().includes(field.toLowerCase()) && typeof obj[key] === 'string') {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.redactSensitiveField(obj[key], field);
      }
    }
  }

  /**
   * Add a request to the tracking array
   */
  private addRequest(request: ApiRequestDetails): void {
    this.requests.push(request);
    
    // Keep the size under control
    if (this.requests.length > this.MAX_STORED_REQUESTS) {
      this.requests = this.requests.slice(-this.MAX_STORED_REQUESTS);
    }
  }
}

// Export singleton instance
export const apiTrackingService = new ApiTrackingService();
export default apiTrackingService; 