# Performance Tracking System API Documentation

This repository contains detailed documentation for the Performance Tracking System API.

## API Modules

The Performance Tracking System API is organized into several modules:

| Module | Description |
|--------|-------------|
| [Goal API](goal-api.md) | Endpoints for managing goals, milestones, and tracking progress |
| [Task API](task-api.md) | Endpoints for managing tasks, time entries, and task statistics |
| [Finance API](finance-api.md) | Endpoints for managing financial accounts, transactions, and summaries |

## Authentication

All API endpoints require authentication via JWT tokens. Include the token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Base URL

All API endpoints are prefixed with:

```
/api/v1/
```

## Response Format

All API responses follow a standard format:

### Success Response

```json
{
  "success": true,
  "message": "Operation successful message",
  "data": {
    // Response data varies by endpoint
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message",
  "errors": {
    // Validation errors (if applicable)
  }
}
```

## Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | OK - The request succeeded |
| 201 | Created - A new resource was created |
| 400 | Bad Request - Invalid input or validation error |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error - Server error |

## Rate Limiting

API requests are limited to 100 requests per minute per user. Exceeding this limit will result in a 429 Too Many Requests response.

## Pagination

List endpoints support pagination with the following query parameters:

- `page`: Page number (default: 1)
- `limit`: Number of items per page (default varies by endpoint)

The response includes pagination metadata:

```json
{
  "success": true,
  "message": "Resources retrieved successfully",
  "data": {
    "items": [
      // Array of resources
    ],
    "total": 100,
    "page": 2,
    "limit": 20,
    "totalPages": 5
  }
}
``` 