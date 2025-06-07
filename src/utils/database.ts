import { PrismaClient } from '@prisma/client';
import logger from './logger';
import config from '../config/config';
import cacheClient, { CacheStrategy, CACHE_TTL } from './cache';
import os from 'os';

/**
 * Database query options
 */
export interface QueryOptions {
  cacheKey?: string;
  cacheStrategy?: CacheStrategy;
  logQuery?: boolean;
  logParams?: boolean;
}

/**
 * Default query options
 */
const DEFAULT_QUERY_OPTIONS: QueryOptions = {
  cacheStrategy: CacheStrategy.NONE,
  logQuery: config.database.logQueries,
  logParams: config.database.logQueryParams,
};

/**
 * Generic type for database operations
 */
type Operation<T> = () => Promise<T>;

/**
 * Prisma event types
 */
interface PrismaQueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

/**
 * Database performance metrics
 */
interface DatabaseMetrics {
  readOperations: number;
  writeOperations: number;
  readBytes: number;
  writeBytes: number;
  totalQueries: number;
  slowQueries: number;
  errors: number;
  avgReadTimeMs: number;
  avgWriteTimeMs: number;
  lastDowntime: Date | null;
  downtimeDurationMs: number;
  isConnected: boolean;
  lastConnectAttempt: Date | null;
  lastPingTimeMs: number;
  readSpeed: string; // human readable format
  writeSpeed: string; // human readable format
}

/**
 * Database utility for optimized Prisma usage with caching
 */
class Database {
  private prisma: PrismaClient;
  private queryCount: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private startTime: number;
  private metrics: DatabaseMetrics;
  private totalReadTimeMs: number = 0;
  private totalWriteTimeMs: number = 0;
  private isInitialized: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startTime = Date.now();
    this.prisma = new PrismaClient(); // Initialize here to avoid 'no initializer' error
    
    // Initialize metrics
    this.metrics = {
      readOperations: 0,
      writeOperations: 0,
      readBytes: 0,
      writeBytes: 0,
      totalQueries: 0,
      slowQueries: 0,
      errors: 0,
      avgReadTimeMs: 0,
      avgWriteTimeMs: 0,
      lastDowntime: null,
      downtimeDurationMs: 0,
      isConnected: false,
      lastConnectAttempt: null,
      lastPingTimeMs: 0,
      readSpeed: '0 KB/s',
      writeSpeed: '0 KB/s'
    };
    
    this.initializePrisma();
    this.setupHealthCheck();
  }

  /**
   * Initialize Prisma client with optimal settings
   */
  private initializePrisma(): void {
    try {
      this.metrics.lastConnectAttempt = new Date();
      
      // Create Prisma client with performance optimizations
      // For MongoDB, we don't need connection pooling settings
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: config.database.url,
          },
        },
        log: [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'event' },
          { level: 'warn', emit: 'event' },
        ],
      });

      // Log slow queries
      // @ts-ignore - Prisma's event system typing is complex
      this.prisma.$on('query', (e: PrismaQueryEvent) => {
        this.queryCount++;
        this.metrics.totalQueries++;
        
        const duration = e.duration;
        const query = e.query.toLowerCase();
        const params = e.params;
        const estimatedDataSize = Buffer.byteLength(JSON.stringify(params || ''));
        
        // Categorize as read or write operation
        const isWriteOperation = query.includes('insert') || 
                                query.includes('update') || 
                                query.includes('delete') || 
                                query.includes('create');
        
        if (isWriteOperation) {
          this.metrics.writeOperations++;
          this.metrics.writeBytes += estimatedDataSize;
          this.totalWriteTimeMs += duration;
          this.metrics.avgWriteTimeMs = this.totalWriteTimeMs / this.metrics.writeOperations;
        } else {
          this.metrics.readOperations++;
          this.metrics.readBytes += estimatedDataSize;
          this.totalReadTimeMs += duration;
          this.metrics.avgReadTimeMs = this.totalReadTimeMs / this.metrics.readOperations;
        }
        
        // Calculate read/write speeds (per second)
        const uptimeSeconds = (Date.now() - this.startTime) / 1000;
        if (uptimeSeconds > 0) {
          const readSpeedBps = this.metrics.readBytes / uptimeSeconds;
          const writeSpeedBps = this.metrics.writeBytes / uptimeSeconds;
          
          this.metrics.readSpeed = this.formatBytesPerSecond(readSpeedBps);
          this.metrics.writeSpeed = this.formatBytesPerSecond(writeSpeedBps);
        }
        
        // Log slow queries
        if (duration > config.database.maxQueryExecutionTime) {
          this.metrics.slowQueries++;
          logger.warn(`Slow query (${duration}ms): ${query}`, { 
            params: config.database.logQueryParams ? params : '[hidden]'
          });
        } else if (config.nodeEnv === 'development' && config.database.logQueries) {
          logger.debug(`Query (${duration}ms): ${query}`, { 
            params: config.database.logQueryParams ? params : '[hidden]'
          });
        }
      });
      
      // Log errors
      // @ts-ignore - Prisma's event system typing is complex
      this.prisma.$on('error', (e: Error) => {
        this.metrics.errors++;
        logger.error('Prisma error', e);
      });

      this.isInitialized = true;
      this.metrics.isConnected = true;
      logger.info('Database connection initialized');
    } catch (error) {
      this.metrics.isConnected = false;
      this.metrics.lastDowntime = new Date();
      this.metrics.errors++;
      
      logger.error('Failed to initialize database connection', 
        error instanceof Error ? error : new Error(String(error)));
      
      // Rethrow as this is critical
      throw error;
    }
  }
  
  /**
   * Setup health check monitoring for database
   */
  private setupHealthCheck(): void {
    // Ping database every 30 seconds to check connection
    this.pingInterval = setInterval(() => {
      this.pingDatabase();
    }, 30000);
    
    // Run more extensive health check every 5 minutes
    this.healthCheckInterval = setInterval(() => {
      this.checkDatabaseHealth();
    }, 300000);
  }
  
  /**
   * Ping database to check if it's responsive
   */
  private async pingDatabase(): Promise<void> {
    const startTime = Date.now();
    try {
      // Just check if we can run a simple query
      await this.prisma.$runCommandRaw({ ping: 1 });
      
      const pingTime = Date.now() - startTime;
      this.metrics.lastPingTimeMs = pingTime;
      
      // If we were disconnected before, calculate downtime
      if (!this.metrics.isConnected && this.metrics.lastDowntime) {
        const downtime = Date.now() - this.metrics.lastDowntime.getTime();
        this.metrics.downtimeDurationMs += downtime;
      }
      
      this.metrics.isConnected = true;
    } catch (error) {
      if (this.metrics.isConnected) {
        // Mark the start of downtime
        this.metrics.lastDowntime = new Date();
      }
      
      this.metrics.isConnected = false;
      this.metrics.errors++;
      
      logger.error('Database ping failed', 
        error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Run more extensive health check on database
   */
  private async checkDatabaseHealth(): Promise<void> {
    try {
      // Check server stats if available
      // This is a MongoDB-specific command
      const serverStatus = await this.prisma.$runCommandRaw({ serverStatus: 1 });
      
      // Log some stats but don't store everything
      logger.info('Database health check completed', {
        connectionCount: typeof serverStatus === 'object' && serverStatus ? 
          (serverStatus as any)?.connections?.current || 'N/A' : 'N/A',
        memory: typeof serverStatus === 'object' && serverStatus ? 
          (serverStatus as any)?.mem?.resident || 'N/A' : 'N/A',
        uptime: typeof serverStatus === 'object' && serverStatus ? 
          (serverStatus as any)?.uptime || 'N/A' : 'N/A'
      });
    } catch (error) {
      logger.error('Database health check failed', 
        error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Format bytes to human-readable string with appropriate units
   */
  private formatBytesPerSecond(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) {
      return `${bytesPerSecond.toFixed(2)} B/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
    } else if (bytesPerSecond < 1024 * 1024 * 1024) {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
    } else {
      return `${(bytesPerSecond / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
    }
  }

  /**
   * Get Prisma client (use with caution, prefer specific methods)
   */
  public getPrisma(): PrismaClient {
    return this.prisma;
  }

  /**
   * Execute query with caching and logging
   */
  public async query<T>(
    operation: Operation<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    const opts = { ...DEFAULT_QUERY_OPTIONS, ...options };
    const { cacheKey, cacheStrategy } = opts;
    
    // If caching is enabled and we have a cache key
    if (config.database.enableQueryCache && 
        cacheStrategy !== CacheStrategy.NONE && 
        cacheKey) {
      
      try {
        // Try to get from cache first
        const cachedResult = await cacheClient.get<T>(cacheKey);
        
        if (cachedResult !== null) {
          this.cacheHits++;
          return cachedResult;
        }
        
        this.cacheMisses++;
      } catch (error) {
        // Log cache error but continue with database query
        logger.error(`Cache error for key ${cacheKey}`, 
          error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    // Execute the database operation
    const result = await operation();
    
    // Cache the result if needed
    if (config.database.enableQueryCache && 
        cacheStrategy !== CacheStrategy.NONE && 
        cacheKey) {
      
      try {
        const ttl = CACHE_TTL[cacheStrategy as keyof typeof CACHE_TTL];
        await cacheClient.set(cacheKey, result, ttl);
      } catch (error) {
        logger.error(`Failed to cache result for key ${cacheKey}`,
          error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    return result;
  }

  /**
   * Clear cache for a specific entity or query
   */
  public async invalidateCache(pattern: string): Promise<void> {
    try {
      await cacheClient.clearByPattern(pattern);
    } catch (error) {
      logger.error(`Failed to invalidate cache for pattern ${pattern}`,
        error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get database statistics and performance metrics
   */
  public getStats(): Record<string, any> {
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    const uptimeFormatted = this.formatUptime(uptime);
    
    const cacheHitRate = this.cacheHits + this.cacheMisses > 0
      ? Math.round((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100)
      : 0;
    
    // Get system information
    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      cpuLoad: os.loadavg()[0].toFixed(2),
      freeMemory: `${Math.round(os.freemem() / (1024 * 1024))} MB`,
      totalMemory: `${Math.round(os.totalmem() / (1024 * 1024))} MB`,
      memoryUsage: `${Math.round((1 - os.freemem() / os.totalmem()) * 100)}%`
    };
    
    return {
      status: this.metrics.isConnected ? 'connected' : 'disconnected',
      uptime: uptimeFormatted,
      uptimeSeconds: uptime,
      queryCount: this.queryCount,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: `${cacheHitRate}%`,
      poolSize: config.database.poolSize,
      cacheEnabled: config.database.enableQueryCache,
      
      // Performance metrics
      performance: {
        readOperations: this.metrics.readOperations,
        writeOperations: this.metrics.writeOperations,
        totalOperations: this.metrics.readOperations + this.metrics.writeOperations,
        avgReadTimeMs: this.metrics.avgReadTimeMs.toFixed(2),
        avgWriteTimeMs: this.metrics.avgWriteTimeMs.toFixed(2),
        readSpeed: this.metrics.readSpeed,
        writeSpeed: this.metrics.writeSpeed,
        slowQueries: this.metrics.slowQueries,
        errors: this.metrics.errors,
        lastPingTimeMs: this.metrics.lastPingTimeMs
      },
      
      // Availability metrics
      availability: {
        isConnected: this.metrics.isConnected,
        lastDowntime: this.metrics.lastDowntime,
        downtimeDuration: this.formatDuration(this.metrics.downtimeDurationMs),
        downtimePercentage: uptime > 0 
          ? ((this.metrics.downtimeDurationMs / 1000) / uptime * 100).toFixed(4) + '%'
          : '0%'
      },
      
      // System information
      system: systemInfo
    };
  }

  /**
   * Format uptime in a human-readable format
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
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
   * Format duration in ms to human-readable format
   */
  private formatDuration(ms: number): string {
    return this.formatUptime(Math.floor(ms / 1000));
  }

  /**
   * Safely disconnect from the database
   */
  public async disconnect(): Promise<void> {
    try {
      // Clear intervals
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      await this.prisma.$disconnect();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error disconnecting from database', 
        error instanceof Error ? error : new Error(String(error)));
    }
  }
}

// Create and export a singleton instance
export const db = new Database();

export default db; 