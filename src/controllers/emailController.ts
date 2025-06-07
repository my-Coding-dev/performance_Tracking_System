import { Request, Response } from 'express';
import emailService from '../services/emailService';
import logger from '../utils/logger';
import db from '../utils/database';
import cacheClient from '../utils/cache';
import os from 'os';

/**
 * Send a system alert email
 */
export const sendAlertEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subject, message, critical } = req.body;
    
    if (!subject || !message) {
      res.status(400).json({ success: false, message: 'Subject and message are required' });
      return;
    }
    
    const result = await emailService.sendSystemAlert(subject, message, critical);
    
    if (result) {
      res.status(200).json({ success: true, message: 'Alert email sent successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send alert email' });
    }
  } catch (error) {
    logger.error('Error sending alert email', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Send a performance report email
 */
export const sendPerformanceReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }
    
    // Generate real performance data
    const dbStats = db.getStats();
    const cacheStats = cacheClient.getStats();
    
    // Create sample API stats
    const apiStats = {
      requestsPerSecond: 42.5,
      avgResponseTime: 120.3,
      successRate: 98.6,
      errorRate: 1.4
    };
    
    // Create sample system stats
    const systemStats = {
      cpuUsage: Math.round((os.loadavg()[0] / os.cpus().length) * 100),
      memoryUsage: Math.round((1 - os.freemem() / os.totalmem()) * 100),
      uptime: formatUptime(os.uptime())
    };
    
    // Sample recommendations
    const recommendations = [
      'Consider increasing database connection pool size to improve concurrency',
      'Add more cache for high-frequency API endpoints to reduce database load',
      'Optimize query performance for slow endpoints'
    ];
    
    // Format database stats
    const formattedDbStats = {
      avgQueryTime: dbStats.performance.avgReadTimeMs,
      queriesPerSecond: Math.round((dbStats.queryCount / 3600) * 100) / 100,
      cacheHitRate: dbStats.cacheHitRate,
      isConnected: dbStats.availability.isConnected
    };
    
    // Format cache stats
    const formattedCacheStats = {
      hitRate: cacheStats.hitRate,
      latency: cacheStats.performance.lastLatencyMs,
      memoryUsage: formatBytes(cacheStats.storage.memorySizeBytes || 0),
      isConnected: cacheStats.availability.isConnected
    };
    
    const reportData = {
      database: formattedDbStats,
      cache: formattedCacheStats,
      api: apiStats,
      system: systemStats,
      recommendations
    };
    
    const result = await emailService.sendPerformanceReport(email, reportData);
    
    if (result) {
      res.status(200).json({ success: true, message: 'Performance report email sent successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send performance report email' });
    }
  } catch (error) {
    logger.error('Error sending performance report email', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Format uptime in a human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 