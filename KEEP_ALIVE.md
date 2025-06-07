# Server Keep-Alive Service

The Performance Tracking System includes a keep-alive service that periodically pings the server to prevent it from going idle. This is particularly useful for deployments on free hosting platforms that put applications to sleep after periods of inactivity.

## Features

- **Periodic Pinging**: Sends HTTP requests to the server at configurable intervals
- **Self-Hosting**: Server can ping itself without external dependencies
- **Configurable Target**: Can ping any endpoint, including external URLs
- **Status Monitoring**: Tracks ping success/failure and response times
- **Graceful Shutdown**: Properly cleans up resources on server shutdown

## Setup Instructions

### 1. Environment Variables

Add the following variables to your `.env` file:

```env
# Keep-Alive Configuration
KEEP_ALIVE_ENABLED=true                   # Enable/disable the keep-alive service
KEEP_ALIVE_INTERVAL_MINUTES=10            # Ping interval in minutes (default: 10)
KEEP_ALIVE_URL=https://your-app.com/api/v1/health/ping   # Optional custom URL to ping
```

### 2. Server Integration

The keep-alive service is automatically initialized when the server starts if `KEEP_ALIVE_ENABLED` is set to `true`. No additional configuration is required.

## How It Works

1. When the server starts, the keep-alive service initializes if enabled
2. It determines the URL to ping based on:
   - The `KEEP_ALIVE_URL` environment variable if provided
   - The server's public URL from `PUBLIC_URL` or `RENDER_EXTERNAL_URL` environment variables
   - A fallback to the local server URL (http://localhost:PORT/api/v1/health/ping)
3. It sends HTTP GET requests to the ping endpoint at the configured interval
4. Each request includes headers identifying it as a keep-alive ping
5. The service logs successful and failed pings for monitoring

## Ping Endpoint

The system provides a dedicated lightweight endpoint for the keep-alive service:

```
GET /api/v1/health/ping
```

Response:
```json
{
  "status": "alive",
  "timestamp": "2023-06-08T12:34:56.789Z",
  "uptime": 3600
}
```

## External Keep-Alive Services

Instead of or in addition to the built-in keep-alive service, you can use external services to ping your application:

1. **UptimeRobot** (https://uptimerobot.com)
   - Free plan includes 50 monitors with 5-minute check intervals
   - Simple setup with email alerts
   - Set up a monitor to ping your `/api/v1/health/ping` endpoint

2. **Cron-job.org** (https://cron-job.org)
   - Free service for scheduled HTTP requests
   - Flexible scheduling with detailed logs
   - Can send different types of HTTP requests

3. **GitHub Actions**
   - Create a scheduled workflow to ping your server
   - Example workflow:
   ```yaml
   name: Keep Server Alive
   
   on:
     schedule:
       - cron: '*/10 * * * *'  # Every 10 minutes
   
   jobs:
     ping:
       runs-on: ubuntu-latest
       steps:
         - name: Ping server
           run: curl -s -o /dev/null -w "%{http_code}" https://your-app.com/api/v1/health/ping
   ```

4. **Pingdom** (https://pingdom.com)
   - Professional uptime monitoring (paid)
   - Comprehensive analytics and alerting
   - Global check locations for better accuracy

## Troubleshooting

### Common Issues

1. **Server still goes to sleep despite keep-alive**
   - Check if the keep-alive service is enabled and running
   - Verify that the ping interval is shorter than the platform's sleep timeout
   - Consider using an external service for more reliable pinging

2. **High CPU usage due to keep-alive**
   - Increase the ping interval to reduce resource usage
   - Use a more lightweight ping endpoint

3. **Cannot reach the server externally**
   - Check if your server is publicly accessible
   - Verify that firewall rules allow incoming HTTP requests
   - Ensure the correct public URL is configured

## API Reference

### KeepAliveService

```typescript
// Start the keep-alive service
keepAliveService.start(customUrl?: string): void

// Stop the keep-alive service
keepAliveService.stop(): void

// Get the service status
keepAliveService.getStatus(): {
  enabled: boolean;
  targetUrl: string;
  intervalMinutes: number;
  isRunning: boolean;
  lastPingTime: Date | null;
  pingCount: number;
  failedPings: number;
}
``` 