# Database and Cache Configuration

This document describes the database and caching system used in the Performance Tracking System.

## Database Configuration

The system uses PostgreSQL with Prisma ORM for efficient data access and management.

### Key Features

- **Connection Pooling**: Optimized connection pool to handle high loads
- **Query Logging**: Configurable logging of slow queries for performance tuning
- **Index Optimization**: Strategic indexes on frequently queried fields
- **Automated Monitoring**: Real-time tracking of query performance
- **Graceful Shutdown**: Proper connection management on application termination

### Database Schema Optimization

The schema has been optimized with the following strategies:

1. **Strategic Indexes**: Added on most frequently queried fields and combinations
2. **Relation Optimization**: Properly defined relations with cascade actions
3. **Composite Indexes**: For common multi-field queries
4. **Type Optimization**: Appropriate field types for performance

### Environment Variables

```
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
DATABASE_POOL_SIZE=10
DATABASE_CONNECTION_TIMEOUT=30000
DATABASE_MAX_QUERY_EXECUTION_TIME=2000
DATABASE_LOG_QUERIES=false
DATABASE_LOG_QUERY_PARAMS=false
DATABASE_ENABLE_QUERY_CACHE=true
DATABASE_QUERY_CACHE_TTL=300
```

## Cache Configuration

The system uses Upstash Redis for distributed caching with the following features:

### Key Features

- **Distributed Cache**: Using Upstash Redis for serverless performance
- **Multi-tier Caching**: Different TTLs for different data types
- **Cache Invalidation**: Pattern-based cache invalidation for fine-grained control
- **Compression**: Automatic compression for large cached objects
- **Cache Statistics**: Real-time monitoring of cache performance

### Caching Strategies

The system implements several caching strategies:

1. **Entity Caching**: Individual database entities cached with medium TTL
2. **Query Caching**: Query results cached with short TTL
3. **Aggregation Caching**: Report and aggregation data cached with medium TTL
4. **User Session Caching**: User session data cached with long TTL

### Environment Variables

```
# Cache Configuration
CACHE_ENABLED=true
UPSTASH_REDIS_REST_URL=https://your-upstash-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-redis-token
CACHE_DEFAULT_TTL=3600
CACHE_PREFIX=ptsys:
CACHE_COMPRESSION_THRESHOLD=1024

# Cache Strategies
CACHE_STRATEGY_ENTITIES=medium
CACHE_STRATEGY_QUERIES=short
CACHE_STRATEGY_AGGREGATIONS=medium
CACHE_STRATEGY_USER_SESSIONS=long
```

## Usage Examples

### Using the Database Utility

```typescript
import db from '../utils/database';
import { CacheStrategy } from '../utils/cache';

// Example of a read operation with caching
async function getUserById(id: string) {
  return await db.query(
    async () => {
      // This is the actual database operation
      const user = await db.getPrisma().user.findUnique({
        where: { id },
        include: { teams: true }
      });
      return user;
    },
    {
      cacheKey: `user:${id}`,
      cacheStrategy: CacheStrategy.MEDIUM
    }
  );
}

// Example of a write operation with cache invalidation
async function updateUser(id: string, data: any) {
  const result = await db.getPrisma().user.update({
    where: { id },
    data
  });
  
  // Invalidate relevant cache entries
  await db.invalidateCache(`user:${id}`);
  
  return result;
}
```

### Cache Patterns

The system uses standardized cache key patterns:

| Pattern | Description | Example |
|---------|-------------|---------|
| `entity:id` | Single entity by ID | `user:123456` |
| `entity:list:params` | List of entities | `users:list:role=admin` |
| `query:name:params` | Query results | `query:performance:userId=123&period=week` |
| `report:type:params` | Report data | `report:performance:teamId=456` |

## Performance Monitoring

The system includes real-time monitoring of database and cache performance:

- Response headers with query counts and cache hit rates (development mode)
- Admin API endpoints for cache and database statistics
- Logging of slow queries and cache misses

## API Endpoints

### Database Status

`GET /api/v1/database/status` - Get database connection status and statistics

### Cache Management

`GET /api/v1/database/cache/status` - Get cache status and configuration
`POST /api/v1/database/cache/invalidate` - Invalidate cache for a specific pattern
`DELETE /api/v1/database/cache/clear` - Clear entire cache 