import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import logger from '../utils/logger';
import db from '../utils/database';
import cacheClient from '../utils/cache';
import os from 'os';
import apiTrackingService, { ApiRequestDetails } from './apiTrackingService';

/**
 * Metrics update intervals in milliseconds
 */
const UPDATE_INTERVALS = {
  FAST: 1000,   // 1 second for time-critical metrics
  MEDIUM: 5000, // 5 seconds for important but less critical metrics
  SLOW: 30000   // 30 seconds for system metrics that don't change frequently
};

/**
 * Available metric types for subscription
 */
export enum MetricType {
  DATABASE = 'database',
  CACHE = 'cache',
  NETWORK = 'network',
  SYSTEM = 'system',
  API_REQUESTS = 'api-requests',
  ALL = 'all'
}

/**
 * WebSocket service for real-time metrics
 */
class WebSocketService {
  private io: SocketServer | null = null;
  private metricIntervals: Record<string, NodeJS.Timeout> = {};
  private activeConnections: number = 0;
  private startTime: number = Date.now();
  private recentApiRequests: ApiRequestDetails[] = [];
  private apiRequestStats = {
    totalRequests: 0,
    requestsPerMinute: 0,
    requestsPerSecond: 0,
    statusCodes: {} as Record<number, number>,
    methodCounts: {} as Record<string, number>,
    averageResponseTime: 0,
    totalResponseTime: 0,
    slowestRequest: 0,
    fastestRequest: Number.MAX_VALUE
  };
  
  /**
   * Initialize WebSocket server
   */
  public initialize(server: HttpServer): void {
    try {
      this.io = new SocketServer(server, {
        cors: {
          origin: '*', // In production, limit this to your domain
          methods: ['GET', 'POST']
        },
        transports: ['websocket', 'polling']
      });
      
      this.setupEventHandlers();
      this.setupApiTrackingListeners();
      this.startMetricCollectors();
      
      logger.info('WebSocket server initialized');
    } catch (error) {
      logger.error('Failed to initialize WebSocket server', 
        error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;
    
    this.io.on('connection', (socket) => {
      this.activeConnections++;
      
      logger.info(`WebSocket client connected. Total connections: ${this.activeConnections}`);
      
      // Send initial data on connection
      this.sendInitialData(socket);
      
      // Handle subscription to specific metrics
      socket.on('subscribe', (metricTypes: string[]) => {
        logger.debug(`Client subscribed to metrics: ${metricTypes.join(', ')}`);
        
        if (!Array.isArray(metricTypes)) {
          metricTypes = [metricTypes];
        }
        
        // Join rooms for each metric type
        metricTypes.forEach(type => {
          if (Object.values(MetricType).includes(type as MetricType)) {
            socket.join(type);
          }
        });
        
        // If subscribed to 'all', join all rooms
        if (metricTypes.includes(MetricType.ALL)) {
          Object.values(MetricType).forEach(type => {
            if (type !== MetricType.ALL) {
              socket.join(type);
            }
          });
        }
      });
      
      // Handle unsubscription from specific metrics
      socket.on('unsubscribe', (metricTypes: string[]) => {
        logger.debug(`Client unsubscribed from metrics: ${metricTypes.join(', ')}`);
        
        if (!Array.isArray(metricTypes)) {
          metricTypes = [metricTypes];
        }
        
        // Leave rooms for each metric type
        metricTypes.forEach(type => {
          if (Object.values(MetricType).includes(type as MetricType)) {
            socket.leave(type);
          }
        });
        
        // If unsubscribed from 'all', leave all rooms
        if (metricTypes.includes(MetricType.ALL)) {
          Object.values(MetricType).forEach(type => {
            if (type !== MetricType.ALL) {
              socket.leave(type);
            }
          });
        }
      });
      
      // Handle API request details request
      socket.on('get-api-request-details', (requestId: string) => {
        const requestDetails = apiTrackingService.getRequestById(requestId);
        if (requestDetails) {
          socket.emit('api-request-details', requestDetails);
        }
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        this.activeConnections--;
        logger.info(`WebSocket client disconnected. Total connections: ${this.activeConnections}`);
      });
    });
  }
  
  /**
   * Set up listeners for API request tracking
   */
  private setupApiTrackingListeners(): void {
    // Listen for new requests
    apiTrackingService.on('request', (requestDetails: ApiRequestDetails) => {
      if (this.io) {
        // Increment total requests
        this.apiRequestStats.totalRequests++;
        
        // Add to method counts
        this.apiRequestStats.methodCounts[requestDetails.method] = 
          (this.apiRequestStats.methodCounts[requestDetails.method] || 0) + 1;
        
        // Broadcast new request event
        this.io.to(MetricType.API_REQUESTS).emit('new-api-request', {
          id: requestDetails.id,
          timestamp: requestDetails.timestamp,
          method: requestDetails.method,
          url: requestDetails.url,
          ip: requestDetails.ip,
          pending: true
        });
      }
    });
    
    // Listen for request completions
    apiTrackingService.on('response', (requestDetails: ApiRequestDetails) => {
      if (this.io && requestDetails.responseStatus && requestDetails.responseTime) {
        // Add to status code counts
        this.apiRequestStats.statusCodes[requestDetails.responseStatus] = 
          (this.apiRequestStats.statusCodes[requestDetails.responseStatus] || 0) + 1;
        
        // Track response times
        this.apiRequestStats.totalResponseTime += requestDetails.responseTime;
        this.apiRequestStats.averageResponseTime = 
          this.apiRequestStats.totalResponseTime / this.apiRequestStats.totalRequests;
        
        // Track fastest/slowest
        if (requestDetails.responseTime > this.apiRequestStats.slowestRequest) {
          this.apiRequestStats.slowestRequest = requestDetails.responseTime;
        }
        if (requestDetails.responseTime < this.apiRequestStats.fastestRequest) {
          this.apiRequestStats.fastestRequest = requestDetails.responseTime;
        }
        
        // Add to recent requests (keeping limited history)
        this.recentApiRequests.unshift(requestDetails);
        if (this.recentApiRequests.length > 50) {
          this.recentApiRequests.pop();
        }
        
        // Broadcast completion event
        this.io.to(MetricType.API_REQUESTS).emit('api-request-completed', {
          id: requestDetails.id,
          responseStatus: requestDetails.responseStatus,
          responseTime: requestDetails.responseTime,
          responseSize: requestDetails.responseSize
        });
      }
    });
  }
  
  /**
   * Send initial data to newly connected clients
   */
  private sendInitialData(socket: any): void {
    try {
      // Get current metrics
      const dbStats = db.getStats();
      const cacheStats = cacheClient.getStats();
      const systemStats = this.getSystemStats();
      const apiStats = this.getApiRequestStats();
      
      // Send initial data
      socket.emit('initialData', {
        database: dbStats,
        cache: cacheStats,
        system: systemStats,
        api: apiStats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Error sending initial data', 
        error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Start metric collection intervals
   */
  private startMetricCollectors(): void {
    // Database metrics (medium frequency)
    this.metricIntervals.database = setInterval(() => {
      this.broadcastDatabaseMetrics();
    }, UPDATE_INTERVALS.MEDIUM);
    
    // Cache metrics (medium frequency)
    this.metricIntervals.cache = setInterval(() => {
      this.broadcastCacheMetrics();
    }, UPDATE_INTERVALS.MEDIUM);
    
    // Network metrics (medium frequency)
    this.metricIntervals.network = setInterval(() => {
      this.broadcastNetworkMetrics();
    }, UPDATE_INTERVALS.MEDIUM);
    
    // System metrics (slow frequency)
    this.metricIntervals.system = setInterval(() => {
      this.broadcastSystemMetrics();
    }, UPDATE_INTERVALS.SLOW);
    
    // Basic metrics (fast frequency)
    this.metricIntervals.basic = setInterval(() => {
      this.broadcastBasicMetrics();
    }, UPDATE_INTERVALS.FAST);
    
    // API request metrics (fast frequency)
    this.metricIntervals.apiRequests = setInterval(() => {
      this.broadcastApiRequestMetrics();
    }, UPDATE_INTERVALS.FAST);
    
    // Update API request rates (every second)
    this.metricIntervals.apiRates = setInterval(() => {
      this.updateApiRequestRates();
    }, 1000);
  }
  
  /**
   * Update API request rate metrics
   */
  private updateApiRequestRates(): void {
    // Calculate requests per second and per minute
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const oneMinuteAgo = now - 60000;
    
    // Count requests in the last second and minute
    const requestsLastSecond = this.recentApiRequests.filter(
      req => new Date(req.timestamp).getTime() > oneSecondAgo
    ).length;
    
    const requestsLastMinute = this.recentApiRequests.filter(
      req => new Date(req.timestamp).getTime() > oneMinuteAgo
    ).length;
    
    this.apiRequestStats.requestsPerSecond = requestsLastSecond;
    this.apiRequestStats.requestsPerMinute = requestsLastMinute;
  }
  
  /**
   * Stop metric collection intervals
   */
  private stopMetricCollectors(): void {
    Object.values(this.metricIntervals).forEach(interval => {
      if (interval) {
        clearInterval(interval);
      }
    });
    
    this.metricIntervals = {};
  }
  
  /**
   * Broadcast database metrics
   */
  private broadcastDatabaseMetrics(): void {
    if (!this.io) return;
    
    try {
      const dbStats = db.getStats();
      
      // Extract only performance-related metrics to reduce payload size
      const metrics = {
        performance: dbStats.performance,
        availability: dbStats.availability,
        cache: {
          hits: dbStats.cacheHits,
          misses: dbStats.cacheMisses,
          hitRate: dbStats.cacheHitRate
        },
        queryCount: dbStats.queryCount,
        timestamp: new Date().toISOString()
      };
      
      this.io.to(MetricType.DATABASE).emit('database-metrics', metrics);
      
    } catch (error) {
      logger.error('Error broadcasting database metrics', 
        error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Broadcast cache metrics
   */
  private broadcastCacheMetrics(): void {
    if (!this.io) return;
    
    try {
      const cacheStats = cacheClient.getStats();
      
      // Extract only performance-related metrics to reduce payload size
      const metrics = {
        performance: cacheStats.performance,
        storage: cacheStats.storage,
        availability: cacheStats.availability,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hitRate,
        timestamp: new Date().toISOString()
      };
      
      this.io.to(MetricType.CACHE).emit('cache-metrics', metrics);
      
    } catch (error) {
      logger.error('Error broadcasting cache metrics', 
        error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Broadcast API request metrics
   */
  private broadcastApiRequestMetrics(): void {
    if (!this.io) return;
    
    try {
      const apiStats = this.getApiRequestStats();
      
      this.io.to(MetricType.API_REQUESTS).emit('api-request-metrics', {
        ...apiStats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Error broadcasting API request metrics', 
        error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Get API request statistics
   */
  private getApiRequestStats(): any {
    return {
      totalRequests: this.apiRequestStats.totalRequests,
      requestsPerSecond: this.apiRequestStats.requestsPerSecond,
      requestsPerMinute: this.apiRequestStats.requestsPerMinute,
      statusCodes: this.apiRequestStats.statusCodes,
      methodCounts: this.apiRequestStats.methodCounts,
      averageResponseTime: this.apiRequestStats.averageResponseTime,
      slowestRequest: this.apiRequestStats.slowestRequest,
      fastestRequest: this.apiRequestStats.fastestRequest !== Number.MAX_VALUE ? 
        this.apiRequestStats.fastestRequest : 0,
      recentRequests: this.recentApiRequests.slice(0, 10).map(req => ({
        id: req.id,
        method: req.method,
        url: req.url,
        timestamp: req.timestamp,
        responseStatus: req.responseStatus,
        responseTime: req.responseTime
      }))
    };
  }
  
  /**
   * Broadcast system metrics
   */
  private broadcastSystemMetrics(): void {
    if (!this.io) return;
    
    try {
      const systemStats = this.getSystemStats();
      
      this.io.to(MetricType.SYSTEM).emit('system-metrics', {
        ...systemStats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Error broadcasting system metrics', 
        error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Broadcast basic metrics (fast updates)
   */
  private broadcastBasicMetrics(): void {
    if (!this.io || this.activeConnections === 0) return;
    
    try {
      // These are lightweight metrics that can be updated frequently
      const metrics = {
        database: {
          isConnected: db.getStats().availability.isConnected,
          lastPingTimeMs: db.getStats().performance.lastPingTimeMs
        },
        cache: {
          isConnected: cacheClient.getStats().availability.isConnected,
          lastLatencyMs: cacheClient.getStats().performance.lastLatencyMs
        },
        system: {
          cpuLoad: os.loadavg()[0].toFixed(2),
          memoryUsedPercent: Math.round((1 - os.freemem() / os.totalmem()) * 100)
        },
        api: {
          requestsPerSecond: this.apiRequestStats.requestsPerSecond,
          totalRequests: this.apiRequestStats.totalRequests
        },
        connections: this.activeConnections,
        uptime: Math.round((Date.now() - this.startTime) / 1000),
        timestamp: new Date().toISOString()
      };
      
      // Broadcast to all connected clients
      this.io.emit('basic-metrics', metrics);
      
    } catch (error) {
      logger.error('Error broadcasting basic metrics', 
        error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Broadcast network metrics
   */
  private broadcastNetworkMetrics(): void {
    if (!this.io) return;
    
    try {
      // For network metrics, we need to collect from active requests
      // This is simplified - in a real implementation you would collect from networkMonitor middleware
      
      // Create basic network metrics object
      const metrics = {
        requestsPerSecond: this.apiRequestStats.requestsPerSecond,
        averageResponseTime: this.apiRequestStats.averageResponseTime,
        totalRequests: this.apiRequestStats.totalRequests,
        requestsByStatusCode: this.getStatusCodeGroups(),
        requestsByMethod: this.apiRequestStats.methodCounts,
        lastRequestTime: this.recentApiRequests[0]?.timestamp || null,
        timestamp: new Date().toISOString()
      };
      
      this.io.to(MetricType.NETWORK).emit('network-metrics', metrics);
      
    } catch (error) {
      logger.error('Error broadcasting network metrics', 
        error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Group status codes by category (2xx, 3xx, etc)
   */
  private getStatusCodeGroups(): Record<string, number> {
    const groups: Record<string, number> = {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0
    };
    
    for (const [code, count] of Object.entries(this.apiRequestStats.statusCodes)) {
      const codeNum = parseInt(code, 10);
      if (codeNum >= 200 && codeNum < 300) groups['2xx'] += count;
      else if (codeNum >= 300 && codeNum < 400) groups['3xx'] += count;
      else if (codeNum >= 400 && codeNum < 500) groups['4xx'] += count;
      else if (codeNum >= 500 && codeNum < 600) groups['5xx'] += count;
    }
    
    return groups;
  }
  
  /**
   * Get current system stats
   */
  private getSystemStats(): Record<string, any> {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      loadAvg: os.loadavg(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      memoryUsage: Math.round((1 - os.freemem() / os.totalmem()) * 100),
      uptime: os.uptime()
    };
  }
  
  /**
   * Shutdown WebSocket service
   */
  public shutdown(): void {
    this.stopMetricCollectors();
    
    if (this.io) {
      this.io.close();
      this.io = null;
      logger.info('WebSocket server shut down');
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();

export default websocketService; 