import axios from 'axios';
import logger from './logger';
import config from '../config/config';

/**
 * Utility to keep the server alive by making periodic requests
 * 
 * This service can be used to:
 * 1. Prevent the server from going to sleep on free hosting platforms
 * 2. Keep connections and caches warm
 * 3. Execute periodic background tasks
 * 
 * Set up environment variables:
 * - KEEP_ALIVE_ENABLED=true
 * - KEEP_ALIVE_URL=https://your-server-url.com/api/v1/health/ping
 * - KEEP_ALIVE_INTERVAL_MINUTES=10
 * 
 * External services that can be used to ping your server:
 * - UptimeRobot (https://uptimerobot.com) - Free plan includes 50 monitors
 * - Cron-job.org (https://cron-job.org) - Free service for scheduled pings
 * - Pingdom (https://pingdom.com) - Professional monitoring (paid)
 * - GitHub Actions - Set up a scheduled workflow to ping your server
 */
class KeepAliveService {
  private interval: NodeJS.Timeout | null = null;
  private intervalMs: number = 10 * 60 * 1000; // 10 minutes
  private serverUrl: string = '';
  private isEnabled: boolean = false;
  private lastPingTime: Date | null = null;
  private pingCount: number = 0;
  private failedPings: number = 0;

  /**
   * Initialize the keep-alive service
   */
  constructor() {
    this.isEnabled = process.env.KEEP_ALIVE_ENABLED === 'true';
    this.serverUrl = process.env.KEEP_ALIVE_URL || '';
    this.intervalMs = parseInt(process.env.KEEP_ALIVE_INTERVAL_MINUTES || '10', 10) * 60 * 1000;
  }

  /**
   * Start the keep-alive service
   */
  public start(customUrl?: string): void {
    if (customUrl) {
      this.serverUrl = customUrl;
    }

    // If no URL is provided, use the current server's URL
    if (!this.serverUrl) {
      const port = config.port;
      const host = process.env.HOST || 'localhost';
      this.serverUrl = `http://${host}:${port}/api/v1/health/ping`;
    }

    if (!this.isEnabled) {
      logger.info('Keep-alive service is disabled');
      return;
    }

    if (this.interval) {
      this.stop();
    }

    logger.info(`Starting keep-alive service. Will ping ${this.serverUrl} every ${this.intervalMs / 60000} minutes`);
    
    // Perform initial ping
    this.pingServer();
    
    // Set up interval
    this.interval = setInterval(() => this.pingServer(), this.intervalMs);
    
    // Ensure interval doesn't prevent Node from exiting
    if (this.interval.unref) {
      this.interval.unref();
    }
  }

  /**
   * Stop the keep-alive service
   */
  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Keep-alive service stopped');
    }
  }

  /**
   * Get the status of the keep-alive service
   */
  public getStatus(): any {
    return {
      enabled: this.isEnabled,
      targetUrl: this.serverUrl,
      intervalMinutes: this.intervalMs / 60000,
      isRunning: this.interval !== null,
      lastPingTime: this.lastPingTime,
      pingCount: this.pingCount,
      failedPings: this.failedPings,
    };
  }

  /**
   * Ping the server to keep it alive
   */
  private async pingServer(): Promise<void> {
    if (!this.serverUrl) {
      logger.warn('Keep-alive service has no target URL');
      return;
    }

    try {
      const startTime = Date.now();
      const response = await axios.get(this.serverUrl, {
        timeout: 5000, // 5 second timeout
        headers: {
          'User-Agent': 'KeepAliveService/1.0',
          'X-Keep-Alive': 'true'
        }
      });
      
      const endTime = Date.now();
      this.lastPingTime = new Date();
      this.pingCount++;
      
      if (response.status === 200) {
        logger.debug(`Keep-alive ping successful (${endTime - startTime}ms)`);
      } else {
        logger.warn(`Keep-alive ping received non-200 response: ${response.status}`);
      }
    } catch (error) {
      this.failedPings++;
      if (error instanceof Error) {
        logger.error(`Keep-alive ping failed: ${error.message}`);
      } else {
        logger.error('Keep-alive ping failed with unknown error');
      }
    }
  }
}

// Export as singleton
const keepAliveService = new KeepAliveService();
export default keepAliveService; 