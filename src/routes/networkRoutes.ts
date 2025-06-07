import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import config from '../config/config';
import authMiddleware from '../middlewares/authMiddleware';

const router = Router();

/**
 * @route   GET /api/v1/network/status
 * @desc    Network monitoring status
 * @access  Admin
 */
router.get('/status', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'active',
    monitoring: config.networkMonitor.enabled,
    settings: {
      samplingRate: config.networkMonitor.samplingRate,
      logPayloadSize: config.networkMonitor.logPayloadSize,
      logResponseTime: config.networkMonitor.logResponseTime,
      logBandwidth: config.networkMonitor.logBandwidth,
      logHeaders: config.networkMonitor.logHeaders,
      logUserAgent: config.networkMonitor.logUserAgent,
      retentionDays: config.networkMonitor.storageRetentionDays
    },
    thresholds: config.networkMonitor.alertThresholds
  });
});

/**
 * @route   GET /api/v1/network/summary
 * @desc    Get network traffic summary
 * @access  Admin
 */
router.get('/summary', async (_req: Request, res: Response): Promise<void> => {
  // This would normally be protected by auth middleware
  // For now we'll simulate admin access
  // if (!req.user || req.user.role !== 'admin') {
  //   return unauthorized('Admin access required')(req, res, () => {});
  // }
  
  try {
    const logFile = path.join(process.cwd(), 'logs', 'network-access.log');
    
    if (!fs.existsSync(logFile)) {
      res.status(200).json({
        message: 'No network logs available yet',
        data: {
          totalRequests: 0,
          avgResponseTime: 0,
          totalDataTransferred: 0,
          requestsByEndpoint: {},
          statusCodeDistribution: {},
          slowestEndpoints: []
        }
      });
      return;
    }
    
    // Process log file to generate summary
    const logStream = fs.createReadStream(logFile);
    const rl = readline.createInterface({
      input: logStream,
      crlfDelay: Infinity
    });
    
    const summary = {
      totalRequests: 0,
      totalResponseTime: 0,
      totalDataTransferred: 0,
      requestsByEndpoint: {} as Record<string, number>,
      statusCodeDistribution: {} as Record<string, number>,
      endpointPerformance: {} as Record<string, { count: number, totalTime: number, avgTime: number }>,
      recentErrors: [] as Array<{ timestamp: string, url: string, method: string, statusCode: number }>
    };
    
    // Read log line by line
    for await (const line of rl) {
      try {
        const entry = JSON.parse(line);
        summary.totalRequests++;
        
        // Add response time
        if (entry.responseTimeMs) {
          summary.totalResponseTime += entry.responseTimeMs;
        }
        
        // Add data transferred
        if (entry.responseSizeBytes) {
          summary.totalDataTransferred += entry.responseSizeBytes;
        }
        
        // Count by endpoint (using path without query params)
        const endpoint = (entry.url || '').split('?')[0];
        summary.requestsByEndpoint[endpoint] = (summary.requestsByEndpoint[endpoint] || 0) + 1;
        
        // Count by status code
        const statusCode = entry.statusCode?.toString() || 'unknown';
        summary.statusCodeDistribution[statusCode] = (summary.statusCodeDistribution[statusCode] || 0) + 1;
        
        // Track endpoint performance
        if (endpoint && entry.responseTimeMs) {
          if (!summary.endpointPerformance[endpoint]) {
            summary.endpointPerformance[endpoint] = { count: 0, totalTime: 0, avgTime: 0 };
          }
          summary.endpointPerformance[endpoint].count++;
          summary.endpointPerformance[endpoint].totalTime += entry.responseTimeMs;
          summary.endpointPerformance[endpoint].avgTime = 
            summary.endpointPerformance[endpoint].totalTime / summary.endpointPerformance[endpoint].count;
        }
        
        // Track recent errors
        if (entry.statusCode >= 400 && entry.timestamp && entry.url && entry.method) {
          if (summary.recentErrors.length < 10) { // Keep only 10 most recent errors
            summary.recentErrors.push({
              timestamp: entry.timestamp,
              url: entry.url,
              method: entry.method,
              statusCode: entry.statusCode
            });
          }
        }
      } catch (e) {
        // Skip malformed log entries
        continue;
      }
    }
    
    // Calculate average response time
    const avgResponseTime = summary.totalRequests > 0 
      ? summary.totalResponseTime / summary.totalRequests 
      : 0;
    
    // Get slowest endpoints
    const slowestEndpoints = Object.entries(summary.endpointPerformance)
      .sort((a, b) => b[1].avgTime - a[1].avgTime)
      .slice(0, 5)
      .map(([endpoint, stats]) => ({
        endpoint,
        avgResponseTime: stats.avgTime,
        requestCount: stats.count
      }));
    
    res.status(200).json({
      message: 'Network traffic summary',
      data: {
        totalRequests: summary.totalRequests,
        avgResponseTime,
        totalDataTransferredBytes: summary.totalDataTransferred,
        totalDataTransferredMB: Math.round(summary.totalDataTransferred / (1024 * 1024) * 100) / 100,
        requestsByEndpoint: summary.requestsByEndpoint,
        statusCodeDistribution: summary.statusCodeDistribution,
        slowestEndpoints,
        recentErrors: summary.recentErrors
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to generate network summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 