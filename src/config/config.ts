import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface NetworkMonitorConfig {
  enabled: boolean;
  samplingRate: number;
  logPayloadSize: boolean;
  logResponseTime: boolean;
  logBandwidth: boolean;
  logHeaders: boolean;
  logUserAgent: boolean;
  storageRetentionDays: number;
  alertThresholds: {
    responseTimeMs: number;
    payloadSizeKb: number;
    errorRate: number;
    bandwidthMbps: number;
  };
}

interface DatabaseConfig {
  url: string;
  poolSize: number;
  connectionTimeout: number;
  maxQueryExecutionTime: number;
  logQueries: boolean;
  logQueryParams: boolean;
  enableQueryCache: boolean;
  queryCacheTTL: number;
}

interface CacheConfig {
  enabled: boolean;
  url: string;
  token: string;
  defaultTTL: number;
  prefix: string;
  compressionThreshold: number;
  strategies: {
    entities: string;
    queries: string;
    aggregations: string;
    userSessions: string;
  };
}

interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  defaultFrom: string;
  tls: {
    rejectUnauthorized: boolean;
  };
  alerts: {
    enabled: boolean;
    recipients: string[];
    criticalRecipients: string[];
  };
}

interface Config {
  appName: string;
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  logLevel: string;
  apiVersion: string;
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    standardHeaders: boolean;
    legacyHeaders: boolean;
  };
  networkMonitor: NetworkMonitorConfig;
  database: DatabaseConfig;
  cache: CacheConfig;
  email: EmailConfig;
}

const config: Config = {
  appName: process.env.APP_NAME || 'Performance Tracking System',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  logLevel: process.env.LOG_LEVEL || 'info',
  apiVersion: process.env.API_VERSION || 'v1',
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // limit each IP to 100 requests per windowMs
    standardHeaders: process.env.RATE_LIMIT_STANDARD_HEADERS !== 'false', // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: process.env.RATE_LIMIT_LEGACY_HEADERS !== 'false', // Disable the `X-RateLimit-*` headers
  },
  networkMonitor: {
    enabled: process.env.NETWORK_MONITOR_ENABLED !== 'false',
    samplingRate: parseFloat(process.env.NETWORK_MONITOR_SAMPLING_RATE || '1.0'), // 1.0 = monitor all requests
    logPayloadSize: process.env.NETWORK_MONITOR_LOG_PAYLOAD_SIZE !== 'false',
    logResponseTime: process.env.NETWORK_MONITOR_LOG_RESPONSE_TIME !== 'false',
    logBandwidth: process.env.NETWORK_MONITOR_LOG_BANDWIDTH !== 'false',
    logHeaders: process.env.NETWORK_MONITOR_LOG_HEADERS !== 'false',
    logUserAgent: process.env.NETWORK_MONITOR_LOG_USER_AGENT !== 'false',
    storageRetentionDays: parseInt(process.env.NETWORK_MONITOR_RETENTION_DAYS || '30', 10),
    alertThresholds: {
      responseTimeMs: parseInt(process.env.NETWORK_MONITOR_THRESHOLD_RESPONSE_TIME || '1000', 10),
      payloadSizeKb: parseInt(process.env.NETWORK_MONITOR_THRESHOLD_PAYLOAD_SIZE || '1024', 10),
      errorRate: parseFloat(process.env.NETWORK_MONITOR_THRESHOLD_ERROR_RATE || '0.05'),
      bandwidthMbps: parseFloat(process.env.NETWORK_MONITOR_THRESHOLD_BANDWIDTH || '50')
    }
  },
  database: {
    url: process.env.DATABASE_URL || '',
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
    connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '30000', 10),
    maxQueryExecutionTime: parseInt(process.env.DATABASE_MAX_QUERY_EXECUTION_TIME || '2000', 10),
    logQueries: process.env.DATABASE_LOG_QUERIES === 'true',
    logQueryParams: process.env.DATABASE_LOG_QUERY_PARAMS === 'true',
    enableQueryCache: process.env.DATABASE_ENABLE_QUERY_CACHE !== 'false',
    queryCacheTTL: parseInt(process.env.DATABASE_QUERY_CACHE_TTL || '300', 10)
  },
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '3600', 10),
    prefix: process.env.CACHE_PREFIX || 'ptsys:',
    compressionThreshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024', 10),
    strategies: {
      entities: process.env.CACHE_STRATEGY_ENTITIES || 'medium',
      queries: process.env.CACHE_STRATEGY_QUERIES || 'short',
      aggregations: process.env.CACHE_STRATEGY_AGGREGATIONS || 'medium',
      userSessions: process.env.CACHE_STRATEGY_USER_SESSIONS || 'long'
    }
  },
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    host: process.env.EMAIL_HOST || '',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASSWORD || ''
    },
    defaultFrom: process.env.EMAIL_FROM || 'noreply@performance-tracking.com',
    tls: {
      rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false'
    },
    alerts: {
      enabled: process.env.EMAIL_ALERTS_ENABLED === 'true',
      recipients: (process.env.EMAIL_ALERT_RECIPIENTS || '').split(',').filter(Boolean),
      criticalRecipients: (process.env.EMAIL_ALERT_CRITICAL_RECIPIENTS || '').split(',').filter(Boolean)
    }
  }
};

export default config; 