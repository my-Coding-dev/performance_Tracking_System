import { Router, Request, Response } from 'express';
import config from '../config/config';
import os from 'os';
import logger from '../utils/logger';
import db from '../utils/database';
import cacheClient from '../utils/cache';
import keepAliveService from '../utils/keepAlive';

const router = Router();

/**
 * @route   GET /api/v1/health
 * @desc    Basic health check endpoint
 * @access  Public
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  const dbStats = db.getStats();
  const cacheStats = cacheClient.getStats();
  
  const dbStatus = {
    connected: dbStats.availability.isConnected,
    latency: dbStats.performance.avgReadTimeMs,
    queryCount: dbStats.queryCount
  };
  
  const cacheStatus = {
    connected: cacheStats.availability.isConnected,
    latency: cacheStats.performance.lastLatencyMs,
    hitRate: cacheStats.hitRate
  };
  
  res.json({
    status: 'ok',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    uptime: uptime,
    system: {
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      cpu: {
        model: os.cpus()[0].model,
        cores: os.cpus().length,
        loadAvg: os.loadavg()
      }
    },
    services: {
      database: dbStatus,
      cache: cacheStatus,
      keepAlive: keepAliveService.getStatus()
    }
  });
});

/**
 * @route   GET /api/v1/health/details
 * @desc    Detailed health check with system information
 * @access  Public
 */
router.get('/details', (_req: Request, res: Response): void => {
  const uptimeHours = process.uptime() / 3600;
  
  const memoryUsage = process.memoryUsage();
  const totalMemoryMB = Math.round(os.totalmem() / (1024 * 1024));
  const freeMemoryMB = Math.round(os.freemem() / (1024 * 1024));
  const usedMemoryMB = totalMemoryMB - freeMemoryMB;
  
  res.status(200).json({
    status: 'ok',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.round(process.uptime()),
      formatted: `${Math.floor(uptimeHours)}h ${Math.floor((uptimeHours % 1) * 60)}m`
    },
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      cpuCores: os.cpus().length,
      loadAverage: os.loadavg(),
      memory: {
        total: `${totalMemoryMB} MB`,
        free: `${freeMemoryMB} MB`,
        used: `${usedMemoryMB} MB`,
        rss: `${Math.round(memoryUsage.rss / (1024 * 1024))} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / (1024 * 1024))} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / (1024 * 1024))} MB`,
        external: `${Math.round((memoryUsage.external || 0) / (1024 * 1024))} MB`
      }
    },
    network: {
      monitoring: config.networkMonitor.enabled ? 'enabled' : 'disabled',
      rateLimiting: {
        windowMs: config.rateLimiting.windowMs,
        maxRequests: config.rateLimiting.maxRequests
      }
    }
  });
});

/**
 * @route GET /api/v1/health/ping
 * @description Simple ping endpoint for keep-alive service
 * @access Public
 */
router.get('/ping', (_req: Request, res: Response): void => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router; 