import config from '../config/config';
import fs from 'fs';
import path from 'path';
// Use commonjs require for rotating-file-stream
const rfs = require('rotating-file-stream');

// Log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Network log entry type
export interface NetworkLogEntry {
  timestamp: string;
  method: string;
  url: string;
  statusCode: number;
  responseTimeMs: number;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
  userAgent?: string;
  ipAddress?: string;
  protocol?: string;
  referrer?: string;
  contentType?: string;
  bandwidthMbps?: number;
  platformInfo?: {
    browser?: string;
    browserVersion?: string;
    os?: string;
    osVersion?: string;
    device?: string;
    mobile?: boolean;
  };
}

// Logger class
class Logger {
  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  
  private logLevel: LogLevel;
  private networkLogStream: NodeJS.WritableStream | null = null;
  
  constructor() {
    this.logLevel = (config.logLevel as LogLevel) || 'info';
    this.setupNetworkLogging();
  }
  
  private setupNetworkLogging(): void {
    if (config.networkMonitor.enabled) {
      try {
        // Ensure log directory exists
        const logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        
        // Create a rotating write stream for network logs
        this.networkLogStream = rfs.createStream('network-access.log', {
          size: '10M', // rotate every 10 MegaBytes written
          interval: '1d', // rotate daily
          compress: 'gzip', // compress rotated files
          path: logDir,
          maxFiles: config.networkMonitor.storageRetentionDays
        });
      } catch (error) {
        console.error('Failed to set up network logging:', error);
      }
    }
  }
  
  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] >= this.logLevels[this.logLevel];
  }
  
  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }
  
  public debug(message: string, meta?: any): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }
  
  public info(message: string, meta?: any): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta));
    }
  }
  
  public warn(message: string, meta?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }
  
  public error(message: string, error?: Error, meta?: any): void {
    if (this.shouldLog('error')) {
      const combinedMeta = error 
        ? { ...meta, error: error.message, stack: error.stack }
        : meta;
      console.error(this.formatMessage('error', message, combinedMeta));
    }
  }
  
  public logNetworkRequest(logEntry: NetworkLogEntry): void {
    if (!config.networkMonitor.enabled) return;
    
    // Apply sampling rate
    if (Math.random() > config.networkMonitor.samplingRate) return;
    
    try {
      // Log based on configuration
      const filteredEntry: Partial<NetworkLogEntry> = {
        timestamp: logEntry.timestamp,
        method: logEntry.method,
        url: logEntry.url,
        statusCode: logEntry.statusCode,
        responseTimeMs: logEntry.responseTimeMs
      };
      
      // Add optional fields based on config
      if (config.networkMonitor.logPayloadSize) {
        filteredEntry.requestSizeBytes = logEntry.requestSizeBytes;
        filteredEntry.responseSizeBytes = logEntry.responseSizeBytes;
      }
      
      if (config.networkMonitor.logBandwidth && logEntry.bandwidthMbps) {
        filteredEntry.bandwidthMbps = logEntry.bandwidthMbps;
      }
      
      if (config.networkMonitor.logUserAgent) {
        filteredEntry.userAgent = logEntry.userAgent;
        filteredEntry.platformInfo = logEntry.platformInfo;
      }
      
      // Check alert thresholds
      const alerts = [];
      if (logEntry.responseTimeMs > config.networkMonitor.alertThresholds.responseTimeMs) {
        alerts.push(`High response time: ${logEntry.responseTimeMs}ms`);
      }
      
      if (logEntry.responseSizeBytes && 
          logEntry.responseSizeBytes > config.networkMonitor.alertThresholds.payloadSizeKb * 1024) {
        alerts.push(`Large response size: ${Math.round(logEntry.responseSizeBytes / 1024)}KB`);
      }
      
      if (logEntry.bandwidthMbps && 
          logEntry.bandwidthMbps > config.networkMonitor.alertThresholds.bandwidthMbps) {
        alerts.push(`High bandwidth usage: ${logEntry.bandwidthMbps}Mbps`);
      }
      
      // Log to console
      if (alerts.length > 0) {
        this.warn(`Network alert: ${alerts.join(', ')}`, filteredEntry);
      } else {
        this.debug('Network request', filteredEntry);
      }
      
      // Log to file
      if (this.networkLogStream) {
        this.networkLogStream.write(JSON.stringify(filteredEntry) + '\n');
      }
    } catch (error) {
      this.error('Failed to log network request', error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export default new Logger(); 