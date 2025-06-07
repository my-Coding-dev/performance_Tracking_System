import { Router, Request, Response } from 'express';
import db from '../utils/database';
import cacheClient from '../utils/cache';
import config from '../config/config';
import { authenticate, authorize } from '../middlewares/auth';
import { AuthRequest } from '../middlewares/auth';

const router = Router();

/**
 * @route   GET /api/v1/database/status
 * @desc    Get database status and statistics
 * @access  Admin
 */
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get real-time stats from database
    const stats = db.getStats();
    
    res.status(200).json({
      status: stats.status,
      uptime: stats.uptime,
      config: {
        url: config.database.url.replace(/^(.*:\/\/[^:]*:).*(@.*)$/, '$1*****$2'), // Hide password
        poolSize: config.database.poolSize,
        connectionTimeout: config.database.connectionTimeout,
        maxQueryExecutionTime: config.database.maxQueryExecutionTime,
        logQueries: config.database.logQueries,
        enableQueryCache: config.database.enableQueryCache,
      },
      performance: stats.performance,
      availability: stats.availability,
      cache: {
        hits: stats.cacheHits,
        misses: stats.cacheMisses,
        hitRate: stats.cacheHitRate,
        enabled: config.database.enableQueryCache
      },
      system: stats.system
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to get database status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route   GET /api/v1/database/cache/status
 * @desc    Get cache status
 * @access  Admin
 */
router.get('/cache/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get real-time stats from cache
    const cacheStats = cacheClient.getStats();
    
    res.status(200).json({
      status: cacheStats.status,
      uptime: cacheStats.uptime,
      config: {
        enabled: config.cache.enabled,
        ttl: config.cache.defaultTTL,
        prefix: config.cache.prefix,
        strategies: config.cache.strategies
      },
      performance: cacheStats.performance,
      storage: cacheStats.storage,
      availability: cacheStats.availability,
      system: cacheStats.system
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to get cache status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route   POST /api/v1/database/cache/invalidate
 * @desc    Invalidate cache for a pattern
 * @access  Admin
 */
router.post('/cache/invalidate', authenticate, authorize(['admin']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pattern } = req.body;
    
    if (!pattern) {
      res.status(400).json({
        message: 'Pattern is required',
      });
      return;
    }
    
    await db.invalidateCache(pattern);
    
    // Get updated cache stats after invalidation
    const cacheStats = cacheClient.getStats();
    
    res.status(200).json({
      message: `Cache invalidated for pattern: ${pattern}`,
      currentKeys: cacheStats.storage.currentKeys,
      status: cacheStats.status
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to invalidate cache',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route   DELETE /api/v1/database/cache/clear
 * @desc    Clear all cache
 * @access  Admin
 */
router.delete('/cache/clear', authenticate, authorize(['admin']), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    await db.invalidateCache('*');
    
    // Get updated cache stats after clearing
    const cacheStats = cacheClient.getStats();
    
    res.status(200).json({
      message: 'Cache cleared successfully',
      currentKeys: cacheStats.storage.currentKeys,
      status: cacheStats.status
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to clear cache',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route   GET /api/v1/database/performance
 * @desc    Get detailed database performance metrics
 * @access  Admin
 */
router.get('/performance', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get full performance data from database
    const dbStats = db.getStats();
    const cacheStats = cacheClient.getStats();
    
    // Combine stats and create performance report
    const performance = {
      database: {
        readSpeed: dbStats.performance.readSpeed,
        writeSpeed: dbStats.performance.writeSpeed,
        avgReadTimeMs: dbStats.performance.avgReadTimeMs,
        avgWriteTimeMs: dbStats.performance.avgWriteTimeMs,
        slowQueries: dbStats.performance.slowQueries,
        readOperations: dbStats.performance.readOperations,
        writeOperations: dbStats.performance.writeOperations,
        totalOperations: dbStats.performance.totalOperations,
        queryRate: dbStats.uptimeSeconds > 0 
          ? (dbStats.performance.totalOperations / dbStats.uptimeSeconds).toFixed(2) + ' queries/s'
          : '0 queries/s',
        errors: dbStats.performance.errors,
        isConnected: dbStats.availability.isConnected,
        downtime: dbStats.availability.downtimePercentage
      },
      cache: {
        readSpeed: cacheStats.performance.readSpeed,
        writeSpeed: cacheStats.performance.writeSpeed,
        avgLatencyMs: cacheStats.performance.avgLatencyMs,
        getOperations: cacheStats.performance.getOperations,
        setOperations: cacheStats.performance.setOperations,
        deleteOperations: cacheStats.performance.deleteOperations,
        totalOperations: cacheStats.performance.totalOperations,
        hitRate: cacheStats.hitRate,
        operationRate: cacheStats.uptimeSeconds > 0 
          ? (cacheStats.performance.totalOperations / cacheStats.uptimeSeconds).toFixed(2) + ' ops/s'
          : '0 ops/s',
        errors: cacheStats.errors,
        isConnected: cacheStats.availability.isConnected,
        downtime: cacheStats.availability.downtimePercentage
      },
      system: {
        hostname: dbStats.system.hostname,
        platform: dbStats.system.platform,
        cpuLoad: dbStats.system.cpuLoad,
        memoryUsage: dbStats.system.memoryUsage,
        freeMemory: dbStats.system.freeMemory,
        totalMemory: dbStats.system.totalMemory
      }
    };
    
    res.status(200).json(performance);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to get performance metrics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 