import { Redis } from '@upstash/redis';
import logger from './logger';
import config from '../config/config';
import os from 'os';

/**
 * Cache key prefix to avoid collisions
 */
const CACHE_PREFIX = 'ptsys:';

/**
 * Default TTL in seconds for cached items
 */
const DEFAULT_TTL = 3600; // 1 hour

/**
 * Redis client options
 */
interface RedisOptions {
  url: string;
  token: string;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  keyPrefix: string;
}

/**
 * Cache strategy options for different types of data
 */
export enum CacheStrategy {
  NONE = 'none',           // No caching
  SHORT = 'short',         // Short TTL (30 seconds)
  MEDIUM = 'medium',       // Medium TTL (5 minutes)
  LONG = 'long',           // Long TTL (1 hour)
  VERY_LONG = 'very_long', // Very long TTL (24 hours)
  PERMANENT = 'permanent', // No expiration
}

/**
 * Cache TTL values for different strategies (in seconds)
 */
export const CACHE_TTL: Record<CacheStrategy, number> = {
  [CacheStrategy.NONE]: 0,
  [CacheStrategy.SHORT]: 30,
  [CacheStrategy.MEDIUM]: 300,
  [CacheStrategy.LONG]: 3600,
  [CacheStrategy.VERY_LONG]: 86400,
  [CacheStrategy.PERMANENT]: -1, // No expiration
};

/**
 * Cache performance metrics
 */
interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  setOperations: number;
  getOperations: number;
  deleteOperations: number;
  bytesSaved: number;
  bytesRead: number;
  totalRequestTime: number;
  lastLatencyMs: number;
  avgLatencyMs: number;
  maxKeys: number;
  currentKeys: number;
  memoryUsageBytes: number;
  readSpeed: string;
  writeSpeed: string;
  isConnected: boolean;
  lastDowntime: Date | null;
  downtimeDurationMs: number;
  lastPingTimeMs: number;
}

/**
 * Cache client for Redis
 */
class CacheClient {
  private redis: Redis | null = null;
  private config: CacheConfig;
  private enabled: boolean;
  private startTime: number = Date.now();
  private metrics: CacheMetrics;
  private pingInterval: NodeJS.Timeout | null = null;
  private keyStatsInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Default configuration
    this.config = {
      enabled: true,
      ttl: DEFAULT_TTL,
      keyPrefix: CACHE_PREFIX,
    };

    // Initialize metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      setOperations: 0,
      getOperations: 0,
      deleteOperations: 0,
      bytesSaved: 0,
      bytesRead: 0,
      totalRequestTime: 0,
      lastLatencyMs: 0,
      avgLatencyMs: 0,
      maxKeys: 0,
      currentKeys: 0,
      memoryUsageBytes: 0,
      readSpeed: '0 KB/s',
      writeSpeed: '0 KB/s',
      isConnected: false,
      lastDowntime: null,
      downtimeDurationMs: 0,
      lastPingTimeMs: 0
    };

    this.enabled = process.env.CACHE_ENABLED !== 'false';
    this.initialize();
    
    // Start monitoring cache
    this.setupMonitoring();
  }

  /**
   * Initialize the Redis client
   */
  private initialize(): void {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;

      if (!url || !token) {
        logger.warn('Redis cache disabled: Missing Upstash Redis credentials');
        this.enabled = false;
        this.metrics.isConnected = false;
        return;
      }

      const options: RedisOptions = { url, token };
      this.redis = new Redis(options);
      this.metrics.isConnected = true;
      
      logger.info('Redis cache initialized');
    } catch (error) {
      logger.error('Failed to initialize Redis cache', error instanceof Error ? error : new Error(String(error)));
      this.enabled = false;
      this.metrics.isConnected = false;
      this.metrics.lastDowntime = new Date();
      this.metrics.errors++;
    }
  }

  /**
   * Setup cache monitoring
   */
  private setupMonitoring(): void {
    // Ping the cache every 30 seconds to check if it's still available
    this.pingInterval = setInterval(() => {
      this.pingCache();
    }, 30000);
    
    // Get cache stats every 5 minutes
    this.keyStatsInterval = setInterval(() => {
      this.getCacheStats();
    }, 300000);
  }
  
  /**
   * Ping the cache to check if it's responsive
   */
  private async pingCache(): Promise<void> {
    if (!this.enabled || !this.redis) {
      this.metrics.isConnected = false;
      return;
    }
    
    const startTime = Date.now();
    try {
      await this.redis.ping();
      
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
      
      logger.error('Cache ping failed', 
        error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Get cache statistics from Redis
   */
  private async getCacheStats(): Promise<void> {
    if (!this.enabled || !this.redis) return;
    
    try {
      // Get number of keys with our prefix
      const keys = await this.redis.keys(`${this.config.keyPrefix}*`);
      this.metrics.currentKeys = keys.length;
      
      // Update max keys if needed
      if (keys.length > this.metrics.maxKeys) {
        this.metrics.maxKeys = keys.length;
      }
      
      // For Upstash Redis, we can't easily get memory usage details
      // So we'll estimate based on the keys and their sizes
      try {
        if (keys.length > 0 && keys.length <= 100) {
          // Only check sizes for a reasonable number of keys to avoid overloading
          let totalSize = 0;
          const values = await this.redis.mget<string[]>(...keys.slice(0, 20));
          for (const value of values) {
            if (value) {
              totalSize += Buffer.byteLength(value);
            }
          }
          
          // Rough estimate of average key size times total keys
          if (values.length > 0) {
            const avgSize = totalSize / values.length;
            this.metrics.memoryUsageBytes = Math.round(avgSize * keys.length);
          }
        }
      } catch (error) {
        // Memory info estimation failed
        logger.debug('Could not estimate Redis memory usage', 
          error instanceof Error ? error : new Error(String(error)));
      }
      
      // Calculate speeds
      const uptimeSeconds = (Date.now() - this.startTime) / 1000;
      if (uptimeSeconds > 0) {
        const readSpeedBps = this.metrics.bytesRead / uptimeSeconds;
        const writeSpeedBps = this.metrics.bytesSaved / uptimeSeconds;
        
        this.metrics.readSpeed = this.formatBytesPerSecond(readSpeedBps);
        this.metrics.writeSpeed = this.formatBytesPerSecond(writeSpeedBps);
      }
    } catch (error) {
      logger.error('Failed to get cache stats', 
        error instanceof Error ? error : new Error(String(error)));
      this.metrics.errors++;
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
   * Format a cache key with prefix
   */
  private formatKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Set a value in the cache
   */
  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;

    const startTime = Date.now();
    try {
      const cacheKey = this.formatKey(key);
      const ttl = ttlSeconds ?? this.config.ttl;
      const serializedValue = JSON.stringify(value);
      const valueSize = Buffer.byteLength(serializedValue);
      
      if (ttl <= 0) {
        // No expiration
        await this.redis.set(cacheKey, serializedValue);
      } else {
        // With expiration
        await this.redis.set(cacheKey, serializedValue, { ex: ttl });
      }
      
      // Update metrics
      this.metrics.setOperations++;
      this.metrics.bytesSaved += valueSize;
      const latency = Date.now() - startTime;
      this.metrics.lastLatencyMs = latency;
      this.metrics.totalRequestTime += latency;
      this.metrics.avgLatencyMs = this.metrics.totalRequestTime / 
        (this.metrics.getOperations + this.metrics.setOperations + this.metrics.deleteOperations);
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Cache set error: ${key}`, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get a value from the cache
   */
  public async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.redis) return null;

    const startTime = Date.now();
    try {
      const cacheKey = this.formatKey(key);
      const value = await this.redis.get<string>(cacheKey);
      
      // Update metrics
      this.metrics.getOperations++;
      const latency = Date.now() - startTime;
      this.metrics.lastLatencyMs = latency;
      this.metrics.totalRequestTime += latency;
      this.metrics.avgLatencyMs = this.metrics.totalRequestTime / 
        (this.metrics.getOperations + this.metrics.setOperations + this.metrics.deleteOperations);
      
      if (!value) {
        this.metrics.misses++;
        return null;
      }
      
      this.metrics.hits++;
      this.metrics.bytesRead += Buffer.byteLength(value);
      
      return JSON.parse(value) as T;
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Cache get error: ${key}`, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Delete a value from the cache
   */
  public async delete(key: string): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;

    const startTime = Date.now();
    try {
      const cacheKey = this.formatKey(key);
      await this.redis.del(cacheKey);
      
      // Update metrics
      this.metrics.deleteOperations++;
      const latency = Date.now() - startTime;
      this.metrics.lastLatencyMs = latency;
      this.metrics.totalRequestTime += latency;
      this.metrics.avgLatencyMs = this.metrics.totalRequestTime / 
        (this.metrics.getOperations + this.metrics.setOperations + this.metrics.deleteOperations);
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Cache delete error: ${key}`, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Clear cache by pattern
   */
  public async clearByPattern(pattern: string): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;

    const startTime = Date.now();
    try {
      const keys = await this.redis.keys(`${this.config.keyPrefix}${pattern}*`);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        
        // Update metrics
        this.metrics.deleteOperations += keys.length;
      }
      
      const latency = Date.now() - startTime;
      this.metrics.lastLatencyMs = latency;
      this.metrics.totalRequestTime += latency;
      this.metrics.avgLatencyMs = this.metrics.totalRequestTime / 
        (this.metrics.getOperations + this.metrics.setOperations + this.metrics.deleteOperations);
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Cache clear error: ${pattern}`, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get multiple values from the cache
   */
  public async mget<T>(keys: string[]): Promise<Record<string, T | null>> {
    if (!this.enabled || !this.redis || keys.length === 0) {
      return {};
    }

    const startTime = Date.now();
    try {
      const cacheKeys = keys.map(key => this.formatKey(key));
      const values = await this.redis.mget<string[]>(...cacheKeys);
      
      const result: Record<string, T | null> = {};
      let hitCount = 0;
      let totalBytesRead = 0;
      
      keys.forEach((key, index) => {
        const value = values[index];
        result[key] = value ? JSON.parse(value) as T : null;
        
        if (value) {
          hitCount++;
          totalBytesRead += Buffer.byteLength(value);
        }
      });
      
      // Update metrics
      this.metrics.getOperations += keys.length;
      this.metrics.hits += hitCount;
      this.metrics.misses += (keys.length - hitCount);
      this.metrics.bytesRead += totalBytesRead;
      
      const latency = Date.now() - startTime;
      this.metrics.lastLatencyMs = latency;
      this.metrics.totalRequestTime += latency;
      this.metrics.avgLatencyMs = this.metrics.totalRequestTime / 
        (this.metrics.getOperations + this.metrics.setOperations + this.metrics.deleteOperations);
      
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache mget error', error instanceof Error ? error : new Error(String(error)));
      return {};
    }
  }

  /**
   * Set multiple values in the cache
   */
  public async mset<T>(entries: Record<string, T>, ttlSeconds?: number): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;

    const startTime = Date.now();
    try {
      const pipeline = this.redis.pipeline();
      const ttl = ttlSeconds ?? this.config.ttl;
      let totalBytes = 0;
      
      Object.entries(entries).forEach(([key, value]) => {
        const cacheKey = this.formatKey(key);
        const serializedValue = JSON.stringify(value);
        totalBytes += Buffer.byteLength(serializedValue);
        
        if (ttl <= 0) {
          // No expiration
          pipeline.set(cacheKey, serializedValue);
        } else {
          // With expiration
          pipeline.set(cacheKey, serializedValue, { ex: ttl });
        }
      });
      
      await pipeline.exec();
      
      // Update metrics
      const entryCount = Object.keys(entries).length;
      this.metrics.setOperations += entryCount;
      this.metrics.bytesSaved += totalBytes;
      
      const latency = Date.now() - startTime;
      this.metrics.lastLatencyMs = latency;
      this.metrics.totalRequestTime += latency;
      this.metrics.avgLatencyMs = this.metrics.totalRequestTime / 
        (this.metrics.getOperations + this.metrics.setOperations + this.metrics.deleteOperations);
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache mset error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Check if a key exists in the cache
   */
  public async exists(key: string): Promise<boolean> {
    if (!this.enabled || !this.redis) return false;

    const startTime = Date.now();
    try {
      const cacheKey = this.formatKey(key);
      const exists = await this.redis.exists(cacheKey) > 0;
      
      // Update metrics
      this.metrics.getOperations++;
      const latency = Date.now() - startTime;
      this.metrics.lastLatencyMs = latency;
      this.metrics.totalRequestTime += latency;
      this.metrics.avgLatencyMs = this.metrics.totalRequestTime / 
        (this.metrics.getOperations + this.metrics.setOperations + this.metrics.deleteOperations);
      
      if (exists) this.metrics.hits++;
      else this.metrics.misses++;
      
      return exists;
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Cache exists error: ${key}`, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get TTL for a key in seconds
   */
  public async ttl(key: string): Promise<number> {
    if (!this.enabled || !this.redis) return -2;

    const startTime = Date.now();
    try {
      const cacheKey = this.formatKey(key);
      const ttl = await this.redis.ttl(cacheKey);
      
      // Update metrics
      this.metrics.getOperations++;
      const latency = Date.now() - startTime;
      this.metrics.lastLatencyMs = latency;
      this.metrics.totalRequestTime += latency;
      this.metrics.avgLatencyMs = this.metrics.totalRequestTime / 
        (this.metrics.getOperations + this.metrics.setOperations + this.metrics.deleteOperations);
      
      return ttl;
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Cache ttl error: ${key}`, error instanceof Error ? error : new Error(String(error)));
      return -2;
    }
  }

  /**
   * Increment a counter in the cache
   */
  public async increment(key: string, value = 1): Promise<number> {
    if (!this.enabled || !this.redis) return -1;

    const startTime = Date.now();
    try {
      const cacheKey = this.formatKey(key);
      const result = await this.redis.incrby(cacheKey, value);
      
      // Update metrics
      this.metrics.setOperations++;
      const latency = Date.now() - startTime;
      this.metrics.lastLatencyMs = latency;
      this.metrics.totalRequestTime += latency;
      this.metrics.avgLatencyMs = this.metrics.totalRequestTime / 
        (this.metrics.getOperations + this.metrics.setOperations + this.metrics.deleteOperations);
      
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Cache increment error: ${key}`, error instanceof Error ? error : new Error(String(error)));
      return -1;
    }
  }

  /**
   * Set cache configuration
   */
  public setConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if cache is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Get cache statistics and performance metrics
   */
  public getStats(): Record<string, any> {
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    const uptimeFormatted = this.formatUptime(uptime);
    
    const hitRate = this.metrics.hits + this.metrics.misses > 0
      ? Math.round((this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100)
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
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      hitRate: `${hitRate}%`,
      errors: this.metrics.errors,
      
      // Performance metrics
      performance: {
        getOperations: this.metrics.getOperations,
        setOperations: this.metrics.setOperations,
        deleteOperations: this.metrics.deleteOperations,
        totalOperations: this.metrics.getOperations + this.metrics.setOperations + this.metrics.deleteOperations,
        avgLatencyMs: this.metrics.avgLatencyMs.toFixed(2),
        lastLatencyMs: this.metrics.lastLatencyMs,
        readSpeed: this.metrics.readSpeed,
        writeSpeed: this.metrics.writeSpeed,
        bytesSaved: this.formatBytes(this.metrics.bytesSaved),
        bytesRead: this.formatBytes(this.metrics.bytesRead)
      },
      
      // Storage metrics
      storage: {
        currentKeys: this.metrics.currentKeys,
        maxKeys: this.metrics.maxKeys,
        memoryUsage: this.formatBytes(this.metrics.memoryUsageBytes)
      },
      
      // Availability metrics
      availability: {
        isConnected: this.metrics.isConnected,
        lastDowntime: this.metrics.lastDowntime,
        downtimeDuration: this.formatDuration(this.metrics.downtimeDurationMs),
        downtimePercentage: uptime > 0 
          ? ((this.metrics.downtimeDurationMs / 1000) / uptime * 100).toFixed(4) + '%'
          : '0%',
        lastPingTimeMs: this.metrics.lastPingTimeMs
      },
      
      // System information
      system: systemInfo
    };
  }
  
  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
  }
  
  /**
   * Clean up resources when shutting down
   */
  public shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.keyStatsInterval) {
      clearInterval(this.keyStatsInterval);
      this.keyStatsInterval = null;
    }
    
    logger.info('Cache client shutdown complete');
  }
}

// Export singleton instance
export const cacheClient = new CacheClient();

export default cacheClient; 