# WebSocket Real-Time Monitoring System

This document provides an overview of the real-time monitoring system implemented with WebSockets for the Performance Tracking System.

## Overview

The monitoring system provides real-time metrics for database performance, cache operations, network activity, and system resources. It uses Socket.IO to establish WebSocket connections between the server and dashboard clients, enabling live updates of performance metrics.

## Features

- **Real-time Updates**: All metrics are streamed in real-time with configurable update intervals
- **Dashboard Visualization**: Interactive charts and metrics display with Chart.js
- **Resource Monitoring**: CPU, memory, database, and cache performance tracking
- **Connection Management**: Status indicators for all system components
- **Selective Subscriptions**: Clients can subscribe to specific metric types

## Architecture

### Server Components

1. **WebSocket Service (`websocketService.ts`)**:
   - Manages Socket.IO server instance
   - Collects metrics from various system components
   - Broadcasts updates at configurable intervals
   - Handles client connections and subscriptions

2. **Metric Collection**:
   - Database metrics from Prisma ORM
   - Cache metrics from Upstash Redis
   - Network metrics from Express middleware
   - System metrics from Node.js OS module

### Client Components

1. **Dashboard UI (`index.html`)**:
   - Responsive layout with status indicators
   - Real-time charts for visualizing metrics
   - Performance statistics display

2. **Dashboard Logic (`dashboard.js`)**:
   - Socket.IO client connection
   - Chart initialization and updates
   - DOM manipulation for metrics display

## Metric Types

The system tracks the following metric types:

### Database Metrics
- Read/write operations count
- Query execution times
- Cache hit rate
- Connection status
- Latency measurements

### Cache Metrics
- Hit/miss counts and ratio
- Keys count and memory usage
- Set/get operation performance
- Latency measurements

### Network Metrics
- Request rates and counts
- Response times
- Status code distribution
- Method distribution

### System Metrics
- CPU usage
- Memory usage
- Uptime
- Host information

## WebSocket Events

### Server to Client Events

- `initialData`: Sent when a client connects, contains base system information
- `database-metrics`: Database performance metrics
- `cache-metrics`: Cache performance metrics
- `network-metrics`: Network traffic metrics
- `system-metrics`: System resource usage metrics
- `basic-metrics`: Fast-updating basic status metrics

### Client to Server Events

- `subscribe`: Subscribe to specific metric types
- `unsubscribe`: Unsubscribe from specific metric types

## Update Intervals

The system uses three update intervals for different types of metrics:

- **Fast (1s)**: For time-critical metrics like connection status
- **Medium (5s)**: For important operational metrics like database stats
- **Slow (30s)**: For system metrics that don't change frequently

## Dashboard Access

The monitoring dashboard is available at:

```
http://localhost:<PORT>/dashboard
```

## Integration

The WebSocket server is integrated with the Express application in `Server.ts` and initializes automatically when the server starts.

## Security Considerations

- The dashboard is publicly accessible by default
- In production, implement authentication for the dashboard
- Restrict CORS settings for WebSocket connections
- Consider rate limiting WebSocket connections

## Performance Impact

The monitoring system has been designed with minimal overhead:

- Metrics collection happens asynchronously
- Update intervals are configurable
- Clients can subscribe only to metrics they need
- WebSocket connections reduce HTTP overhead
- Data is selectively filtered to reduce payload size 