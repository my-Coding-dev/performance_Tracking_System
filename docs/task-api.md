# Task API Documentation

This document provides detailed information about the Task API endpoints available in the Performance Tracking System.

## Authentication

All endpoints require authentication. Include a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Base URL

```
/api/v1/tasks
```

## Endpoints

### Create a Task

Create a new task for tracking daily work items.

**URL**: `POST /api/v1/tasks`

**Auth required**: Yes

**Request Body**:

```json
{
  "title": "Implement new feature",
  "description": "Add user profile customization feature",
  "status": "todo",
  "priority": "high",
  "teamId": "optional-team-id",
  "dueDate": "2025-06-15T00:00:00.000Z",
  "estimatedHours": 4,
  "tags": ["feature", "frontend"],
  "parentTaskId": "optional-parent-task-id",
  "startDate": "2025-06-10T00:00:00.000Z",
  "recurringType": "weekly",
  "recurringInterval": 1,
  "goalId": "related-goal-id"
}
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| title | string | Task title | Yes |
| description | string | Detailed description | No |
| status | string | Task status (todo, in_progress, completed, archived) | Yes |
| priority | string | Task priority (low, medium, high, urgent) | Yes |
| teamId | string | Team ID if this is a team task | No |
| dueDate | ISO date | Due date for the task | No |
| estimatedHours | number | Estimated hours to complete | No |
| tags | array | Array of tags for categorization | No |
| parentTaskId | string | Parent task ID for hierarchical tasks | No |
| startDate | ISO date | Start date for the task | No |
| recurringType | string | Type of recurrence (none, daily, weekly, monthly) | No |
| recurringInterval | number | Interval for recurring tasks | No |
| goalId | string | Related goal ID | No |

**Success Response**:

- **Code**: 201 Created
- **Content**:

```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "id": "task-uuid",
    "title": "Implement new feature",
    "description": "Add user profile customization feature",
    "status": "todo",
    "priority": "high",
    "userId": "user-uuid",
    "teamId": "team-uuid",
    "dueDate": "2025-06-15T00:00:00.000Z",
    "estimatedHours": 4,
    "actualHours": null,
    "completedAt": null,
    "startDate": "2025-06-10T00:00:00.000Z",
    "recurringType": "weekly",
    "recurringInterval": 1,
    "parentTaskId": "parent-task-uuid",
    "tags": ["feature", "frontend"],
    "metadata": "{}",
    "createdAt": "2025-06-08T04:05:10.123Z",
    "updatedAt": "2025-06-08T04:05:10.123Z",
    "goalId": "goal-uuid"
  }
}
```

**Error Response**:

- **Code**: 400 Bad Request
- **Content**:

```json
{
  "success": false,
  "message": "Missing required fields",
  "errors": {
    "title": "Title is required",
    "status": "Status is required",
    "priority": "Priority is required"
  }
}
```

### Get All Tasks

Retrieve all tasks for the current user with filtering and pagination.

**URL**: `GET /api/v1/tasks`

**Auth required**: Yes

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string/array | Filter by status (todo, in_progress, completed, archived) |
| priority | string/array | Filter by priority (low, medium, high, urgent) |
| dueDate | object | Filter by due date range (from, to) |
| tags | array | Filter by tags |
| search | string | Search in title and description |
| parentTaskId | string | Filter by parent task ID |
| teamId | string | Filter by team ID |
| goalId | string | Filter by goal ID |
| isCompleted | boolean | Filter by completion status |
| isOverdue | boolean | Filter by overdue status |
| sortBy | string | Field to sort by (dueDate, priority, etc.) |
| sortOrder | string | Sort order (asc or desc) |
| page | number | Page number for pagination (default: 1) |
| limit | number | Number of items per page (default: 20) |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Tasks retrieved successfully",
  "data": {
    "tasks": [
      {
        "id": "task-uuid-1",
        "title": "Implement new feature",
        "description": "Add user profile customization feature",
        "status": "todo",
        "priority": "high",
        "userId": "user-uuid",
        "teamId": "team-uuid",
        "dueDate": "2025-06-15T00:00:00.000Z",
        "estimatedHours": 4,
        "actualHours": null,
        "completedAt": null,
        "startDate": "2025-06-10T00:00:00.000Z",
        "recurringType": "weekly",
        "recurringInterval": 1,
        "parentTaskId": null,
        "tags": ["feature", "frontend"],
        "metadata": "{}",
        "createdAt": "2025-06-08T04:05:10.123Z",
        "updatedAt": "2025-06-08T04:05:10.123Z",
        "goalId": "goal-uuid",
        "timeEntries": [
          {
            "id": "time-entry-uuid",
            "startTime": "2025-06-08T04:05:10.123Z",
            "endTime": "2025-06-08T05:05:10.123Z",
            "duration": 3600,
            "description": "Working on frontend components"
          }
        ],
        "subtasks": [
          {
            "id": "subtask-uuid",
            "title": "Design UI mockups",
            "status": "completed"
          }
        ]
      }
    ],
    "total": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### Get Task by ID

Retrieve a specific task by its ID.

**URL**: `GET /api/v1/tasks/:id`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| id | Task UUID |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Task retrieved successfully",
  "data": {
    "id": "task-uuid",
    "title": "Implement new feature",
    "description": "Add user profile customization feature",
    "status": "todo",
    "priority": "high",
    "userId": "user-uuid",
    "teamId": "team-uuid",
    "dueDate": "2025-06-15T00:00:00.000Z",
    "estimatedHours": 4,
    "actualHours": null,
    "completedAt": null,
    "startDate": "2025-06-10T00:00:00.000Z",
    "recurringType": "weekly",
    "recurringInterval": 1,
    "parentTaskId": null,
    "tags": ["feature", "frontend"],
    "metadata": "{}",
    "createdAt": "2025-06-08T04:05:10.123Z",
    "updatedAt": "2025-06-08T04:05:10.123Z",
    "goalId": "goal-uuid",
    "subtasks": [
      {
        "id": "subtask-uuid",
        "title": "Design UI mockups",
        "description": "Create mockups for the new feature",
        "status": "completed",
        "priority": "medium",
        "userId": "user-uuid",
        "teamId": "team-uuid",
        "dueDate": "2025-06-12T00:00:00.000Z",
        "parentTaskId": "task-uuid",
        "createdAt": "2025-06-08T04:05:10.123Z",
        "updatedAt": "2025-06-08T04:05:10.123Z"
      }
    ],
    "timeEntries": [
      {
        "id": "time-entry-uuid",
        "taskId": "task-uuid",
        "userId": "user-uuid",
        "startTime": "2025-06-08T04:05:10.123Z",
        "endTime": "2025-06-08T05:05:10.123Z",
        "duration": 3600,
        "description": "Working on frontend components",
        "createdAt": "2025-06-08T04:05:10.123Z",
        "updatedAt": "2025-06-08T05:05:10.123Z"
      }
    ]
  }
}
```

### Update Task

Update an existing task.

**URL**: `PUT /api/v1/tasks/:id`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| id | Task UUID |

**Request Body**:

```json
{
  "title": "Updated feature implementation",
  "description": "Updated description",
  "status": "in_progress",
  "priority": "high",
  "teamId": "team-uuid",
  "dueDate": "2025-06-20T00:00:00.000Z",
  "estimatedHours": 6,
  "actualHours": 2,
  "completedAt": null,
  "startDate": "2025-06-10T00:00:00.000Z",
  "recurringType": "weekly",
  "recurringInterval": 1,
  "tags": ["feature", "frontend", "ui"],
  "parentTaskId": null,
  "goalId": "goal-uuid"
}
```

All fields are optional. Only include fields you wish to update.

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Task updated successfully",
  "data": {
    "id": "task-uuid",
    "title": "Updated feature implementation",
    "description": "Updated description",
    "status": "in_progress",
    "priority": "high",
    "userId": "user-uuid",
    "teamId": "team-uuid",
    "dueDate": "2025-06-20T00:00:00.000Z",
    "estimatedHours": 6,
    "actualHours": 2,
    "completedAt": null,
    "startDate": "2025-06-10T00:00:00.000Z",
    "recurringType": "weekly",
    "recurringInterval": 1,
    "parentTaskId": null,
    "tags": ["feature", "frontend", "ui"],
    "metadata": "{}",
    "createdAt": "2025-06-08T04:05:10.123Z",
    "updatedAt": "2025-06-08T04:15:20.456Z",
    "goalId": "goal-uuid"
  }
}
```

### Delete Task

Delete a task by its ID.

**URL**: `DELETE /api/v1/tasks/:id`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| id | Task UUID |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

### Create Time Entry

Create a new time entry for a task.

**URL**: `POST /api/v1/tasks/:taskId/time-entries`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| taskId | Task UUID |

**Request Body**:

```json
{
  "startTime": "2025-06-08T04:05:10.123Z",
  "endTime": "2025-06-08T05:05:10.123Z",
  "duration": 3600,
  "description": "Working on frontend components",
  "focusSessionId": "optional-focus-session-id"
}
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| startTime | ISO date | Start time of the task work | Yes |
| endTime | ISO date | End time of the task work | No |
| duration | number | Duration in seconds (calculated if endTime is provided) | No |
| description | string | Description of work done | No |
| focusSessionId | string | Related focus session ID | No |

**Success Response**:

- **Code**: 201 Created
- **Content**:

```json
{
  "success": true,
  "message": "Time entry created successfully",
  "data": {
    "id": "time-entry-uuid",
    "taskId": "task-uuid",
    "userId": "user-uuid",
    "startTime": "2025-06-08T04:05:10.123Z",
    "endTime": "2025-06-08T05:05:10.123Z",
    "duration": 3600,
    "description": "Working on frontend components",
    "focusSessionId": "focus-session-uuid",
    "createdAt": "2025-06-08T05:06:10.123Z",
    "updatedAt": "2025-06-08T05:06:10.123Z"
  }
}
```

### Get Time Entries for Task

Get all time entries for a specific task.

**URL**: `GET /api/v1/tasks/:taskId/time-entries`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| taskId | Task UUID |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Time entries retrieved successfully",
  "data": [
    {
      "id": "time-entry-uuid-1",
      "taskId": "task-uuid",
      "userId": "user-uuid",
      "startTime": "2025-06-08T04:05:10.123Z",
      "endTime": "2025-06-08T05:05:10.123Z",
      "duration": 3600,
      "description": "Working on frontend components",
      "focusSessionId": "focus-session-uuid",
      "createdAt": "2025-06-08T05:06:10.123Z",
      "updatedAt": "2025-06-08T05:06:10.123Z"
    },
    {
      "id": "time-entry-uuid-2",
      "taskId": "task-uuid",
      "userId": "user-uuid",
      "startTime": "2025-06-09T04:05:10.123Z",
      "endTime": "2025-06-09T06:05:10.123Z",
      "duration": 7200,
      "description": "Implementing backend logic",
      "focusSessionId": null,
      "createdAt": "2025-06-09T06:06:10.123Z",
      "updatedAt": "2025-06-09T06:06:10.123Z"
    }
  ]
}
```

### Update Time Entry

Update an existing time entry.

**URL**: `PUT /api/v1/tasks/:taskId/time-entries/:timeEntryId`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| taskId | Task UUID |
| timeEntryId | Time Entry UUID |

**Request Body**:

```json
{
  "startTime": "2025-06-08T04:10:10.123Z",
  "endTime": "2025-06-08T05:10:10.123Z",
  "duration": 3600,
  "description": "Updated description"
}
```

All fields are optional. Only include fields you wish to update.

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Time entry updated successfully",
  "data": {
    "id": "time-entry-uuid",
    "taskId": "task-uuid",
    "userId": "user-uuid",
    "startTime": "2025-06-08T04:10:10.123Z",
    "endTime": "2025-06-08T05:10:10.123Z",
    "duration": 3600,
    "description": "Updated description",
    "focusSessionId": "focus-session-uuid",
    "createdAt": "2025-06-08T05:06:10.123Z",
    "updatedAt": "2025-06-08T05:15:20.456Z"
  }
}
```

### Get Task Statistics

Get statistics about tasks for the current user.

**URL**: `GET /api/v1/tasks/statistics`

**Auth required**: Yes

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Task statistics retrieved successfully",
  "data": {
    "total": 25,
    "completed": 15,
    "inProgress": 5,
    "todo": 5,
    "overdue": 2,
    "completionRate": 60,
    "averageCompletionTime": 172800,
    "upcomingDeadlines": [
      {
        "id": "task-uuid-1",
        "title": "Complete documentation",
        "status": "in_progress",
        "priority": "high",
        "dueDate": "2025-06-10T00:00:00.000Z"
      },
      {
        "id": "task-uuid-2",
        "title": "Fix critical bug",
        "status": "todo",
        "priority": "urgent",
        "dueDate": "2025-06-11T00:00:00.000Z"
      }
    ]
  }
}
```

## Error Responses

### Authentication Error

- **Code**: 401 Unauthorized
- **Content**:

```json
{
  "success": false,
  "message": "Authentication required"
}
```

### Not Found Error

- **Code**: 404 Not Found
- **Content**:

```json
{
  "success": false,
  "message": "Task not found"
}
```

### Server Error

- **Code**: 500 Internal Server Error
- **Content**:

```json
{
  "success": false,
  "message": "Failed to [operation]"
}
``` 