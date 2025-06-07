import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import http from 'http';
import path from 'path';
import config from './config/config';
import { handleError, notFound } from './utils/errorHandler';
import logger from './utils/logger';
import db from './utils/database';
import cacheClient from './utils/cache';
import networkMonitor from './middlewares/networkMonitor';
import { apiRateLimiter } from './middlewares/rateLimit';
import { databaseMiddleware, databaseTraceMiddleware } from './middlewares/databaseMiddleware';
import apiTrackingMiddleware from './middlewares/apiTrackingMiddleware';
import websocketService from './services/websocketService';
import emailService from './services/emailService';
import keepAliveService from './utils/keepAlive';

// Import routes
import healthRoutes from './routes/healthRoutes';
import networkRoutes from './routes/networkRoutes';
import databaseRoutes from './routes/databaseRoutes';
import emailRoutes from './routes/emailRoutes';
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import goalRoutes from './routes/goalRoutes';
import financeRoutes from './routes/financeRoutes';
import analyticsRoutes from './routes/analyticsRoutes';

// Create Express app
const app: Express = express();
const PORT: number = config.port;

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket service
websocketService.initialize(server);

// Apply security middleware with customized CSP for dashboard
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  })
);

app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Apply rate limiting
app.use(apiRateLimiter);

// Apply monitoring middleware
app.use(networkMonitor);
app.use(databaseTraceMiddleware);
app.use(databaseMiddleware);
app.use(apiTrackingMiddleware); // API request tracking

// Apply standard middleware
app.use(morgan('dev')); // Request logging
app.use(compression()); // Response compression
app.use(express.json({ limit: '1mb' })); // Parse JSON bodies with size limit
app.use(express.urlencoded({ extended: true, limit: '1mb' })); // Parse URL-encoded bodies with size limit

// Serve static files for the dashboard
app.use('/dashboard', express.static(path.join(__dirname, 'public')));

// Version prefix for all API routes
const API_PREFIX = `/api/${config.apiVersion}`;

// Basic routes
app.get('/', (_req: Request, res: Response): void => {
  res.json({ 
    message: 'Welcome to Performance Tracking System API',
    version: config.apiVersion,
    environment: config.nodeEnv,
    dashboard: '/dashboard'
  });
});

// Dashboard route
app.get('/dashboard', (_req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes
app.use(`${API_PREFIX}/health`, healthRoutes);
app.use(`${API_PREFIX}/network`, networkRoutes);
app.use(`${API_PREFIX}/database`, databaseRoutes);
app.use(`${API_PREFIX}/email`, emailRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/tasks`, taskRoutes);
app.use(`${API_PREFIX}/goals`, goalRoutes);
app.use(`${API_PREFIX}/finance`, financeRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
// app.use(`${API_PREFIX}/users`, userRoutes);
// app.use(`${API_PREFIX}/performance`, performanceRoutes);

// 404 handler
app.use((_req: Request, res: Response): void => {
  handleError(notFound(), res);
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  logger.error('Unhandled error', err);
  handleError(err, res);
});

// Start server
server.listen(PORT, (): void => {
  logger.info(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
  logger.info(`Dashboard available at http://localhost:${PORT}/dashboard`);
  logger.info(`Network monitoring ${config.networkMonitor.enabled ? 'enabled' : 'disabled'}`);
  logger.info(`API request tracking enabled`);
  logger.info(`Email service ${config.email.enabled ? 'enabled' : 'disabled'}`);
  logger.info(`Cache ${cacheClient.isEnabled() ? 'enabled' : 'disabled'}`);
  logger.info(`Database connection established with pool size: ${config.database.poolSize}`);
  logger.info(`Rate limiting: ${config.rateLimiting.maxRequests} requests per ${config.rateLimiting.windowMs / 60000} minutes`);
  
  // Start keep-alive service if enabled
  if (process.env.KEEP_ALIVE_ENABLED === 'true') {
    // If this is the production server, determine the URL from environment or defaults
    const isProduction = config.nodeEnv === 'production';
    const publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '';
    
    if (isProduction && publicUrl) {
      // Use the public URL if available
      keepAliveService.start(`${publicUrl}/api/v1/health/ping`);
    } else {
      // Otherwise use the local URL
      keepAliveService.start();
    }
  }
});

// Handle application shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  websocketService.shutdown();
  cacheClient.shutdown();
  emailService.shutdown();
  keepAliveService.stop();
  await db.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  websocketService.shutdown();
  cacheClient.shutdown();
  emailService.shutdown();
  keepAliveService.stop();
  await db.disconnect();
  process.exit(0);
});

export default app;
