# Goal API Documentation

This document provides detailed information about the Goal API endpoints available in the Performance Tracking System.

## Authentication

All endpoints require authentication. Include a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Base URL

```
/api/v1/goals
```

## Endpoints

### Create a Goal

Create a new goal for tracking progress towards objectives.

**URL**: `POST /api/v1/goals`

**Auth required**: Yes

**Request Body**:

```json
{
  "title": "Complete Project X",
  "description": "Finish all requirements for Project X by the deadline",
  "category": "work",
  "teamId": "optional-team-id",
  "targetValue": 100,
  "startDate": "2025-06-15T00:00:00.000Z",
  "endDate": "2025-07-15T00:00:00.000Z",
  "parentGoalId": "optional-parent-goal-id",
  "isPublic": false,
  "metadata": {
    "priority": "high",
    "stakeholders": ["John", "Sarah"]
  }
}
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| title | string | Goal title | Yes |
| description | string | Detailed description | No |
| category | string | Goal category (work, personal, health, etc.) | Yes |
| teamId | string | Team ID if this is a team goal | No |
| targetValue | number | Target numerical value (default: 100) | No |
| startDate | ISO date | Start date (default: current date) | No |
| endDate | ISO date | Target end date | No |
| parentGoalId | string | Parent goal ID for hierarchical goals | No |
| isPublic | boolean | Whether the goal is publicly visible | No |
| metadata | object | Additional custom information | No |

**Success Response**:

- **Code**: 201 Created
- **Content**:

```json
{
  "success": true,
  "message": "Goal created successfully",
  "data": {
    "id": "goal-uuid",
    "title": "Complete Project X",
    "description": "Finish all requirements for Project X by the deadline",
    "userId": "user-uuid",
    "teamId": "team-uuid",
    "category": "work",
    "targetValue": 100,
    "currentValue": 0,
    "startDate": "2025-06-15T00:00:00.000Z",
    "endDate": "2025-07-15T00:00:00.000Z",
    "status": "active",
    "completedAt": null,
    "parentGoalId": "parent-goal-uuid",
    "isPublic": false,
    "metadata": "{\"priority\":\"high\",\"stakeholders\":[\"John\",\"Sarah\"]}",
    "createdAt": "2025-06-08T04:05:10.123Z",
    "updatedAt": "2025-06-08T04:05:10.123Z"
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
    "category": "Category is required"
  }
}
```

### Get All Goals

Retrieve all goals for the current user with filtering and pagination.

**URL**: `GET /api/v1/goals`

**Auth required**: Yes

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| category | string/array | Filter by category (work, personal, etc.) |
| status | string/array | Filter by status (active, completed, abandoned) |
| parentGoalId | string | Filter by parent goal ID (use "null" for top-level goals) |
| teamId | string | Filter by team ID |
| search | string | Search in title and description |
| isPublic | boolean | Filter by public/private status |
| dateRangeFrom | ISO date | Filter goals starting after this date |
| dateRangeTo | ISO date | Filter goals starting before this date |
| sortBy | string | Field to sort by (createdAt, startDate, etc.) |
| sortOrder | string | Sort order (asc or desc) |
| page | number | Page number for pagination (default: 1) |
| limit | number | Number of items per page (default: 10) |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Goals retrieved successfully",
  "data": {
    "goals": [
      {
        "id": "goal-uuid-1",
        "title": "Complete Project X",
        "description": "Finish all requirements for Project X by the deadline",
        "userId": "user-uuid",
        "teamId": "team-uuid",
        "category": "work",
        "targetValue": 100,
        "currentValue": 25,
        "startDate": "2025-06-15T00:00:00.000Z",
        "endDate": "2025-07-15T00:00:00.000Z",
        "status": "active",
        "completedAt": null,
        "parentGoalId": null,
        "isPublic": false,
        "metadata": "{\"priority\":\"high\",\"stakeholders\":[\"John\",\"Sarah\"]}",
        "createdAt": "2025-06-08T04:05:10.123Z",
        "updatedAt": "2025-06-08T04:05:10.123Z",
        "milestones": [
          {
            "id": "milestone-uuid",
            "title": "Complete design phase",
            "isCompleted": true,
            "targetValue": null,
            "dueDate": "2025-06-20T00:00:00.000Z"
          }
        ],
        "_count": {
          "tasks": 3,
          "subgoals": 0
        }
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

### Get Goal by ID

Retrieve a specific goal by its ID.

**URL**: `GET /api/v1/goals/:id`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| id | Goal UUID |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Goal retrieved successfully",
  "data": {
    "id": "goal-uuid",
    "title": "Complete Project X",
    "description": "Finish all requirements for Project X by the deadline",
    "userId": "user-uuid",
    "teamId": "team-uuid",
    "category": "work",
    "targetValue": 100,
    "currentValue": 25,
    "startDate": "2025-06-15T00:00:00.000Z",
    "endDate": "2025-07-15T00:00:00.000Z",
    "status": "active",
    "completedAt": null,
    "parentGoalId": null,
    "isPublic": false,
    "metadata": "{\"priority\":\"high\",\"stakeholders\":[\"John\",\"Sarah\"]}",
    "createdAt": "2025-06-08T04:05:10.123Z",
    "updatedAt": "2025-06-08T04:05:10.123Z",
    "milestones": [
      {
        "id": "milestone-uuid",
        "goalId": "goal-uuid",
        "title": "Complete design phase",
        "description": "Finalize all design components",
        "targetValue": null,
        "isCompleted": true,
        "dueDate": "2025-06-20T00:00:00.000Z",
        "completedAt": "2025-06-19T00:00:00.000Z",
        "createdAt": "2025-06-08T04:05:10.123Z",
        "updatedAt": "2025-06-19T00:00:00.000Z"
      }
    ],
    "subgoals": [],
    "tasks": [
      {
        "id": "task-uuid",
        "title": "Research requirements",
        "status": "completed",
        "dueDate": "2025-06-18T00:00:00.000Z"
      }
    ]
  }
}
```

### Update Goal

Update an existing goal.

**URL**: `PUT /api/v1/goals/:id`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| id | Goal UUID |

**Request Body**:

```json
{
  "title": "Updated Project X",
  "description": "Updated description",
  "category": "work",
  "teamId": "team-uuid",
  "targetValue": 100,
  "currentValue": 50,
  "startDate": "2025-06-15T00:00:00.000Z",
  "endDate": "2025-08-15T00:00:00.000Z",
  "status": "active",
  "parentGoalId": null,
  "isPublic": true,
  "metadata": {
    "priority": "medium",
    "stakeholders": ["John", "Sarah", "Mark"]
  }
}
```

All fields are optional. Only include fields you wish to update.

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Goal updated successfully",
  "data": {
    "id": "goal-uuid",
    "title": "Updated Project X",
    "description": "Updated description",
    "userId": "user-uuid",
    "teamId": "team-uuid",
    "category": "work",
    "targetValue": 100,
    "currentValue": 50,
    "startDate": "2025-06-15T00:00:00.000Z",
    "endDate": "2025-08-15T00:00:00.000Z",
    "status": "active",
    "completedAt": null,
    "parentGoalId": null,
    "isPublic": true,
    "metadata": "{\"priority\":\"medium\",\"stakeholders\":[\"John\",\"Sarah\",\"Mark\"]}",
    "createdAt": "2025-06-08T04:05:10.123Z",
    "updatedAt": "2025-06-08T04:15:20.456Z"
  }
}
```

### Delete Goal

Delete a goal by its ID.

**URL**: `DELETE /api/v1/goals/:id`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| id | Goal UUID |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Goal deleted successfully"
}
```

**Error Response**:

- **Code**: 400 Bad Request
- **Content**:

```json
{
  "success": false,
  "message": "Cannot delete goal with subgoals"
}
```

### Get Goal Progress

Get detailed progress information for a goal.

**URL**: `GET /api/v1/goals/:id/progress`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| id | Goal UUID |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Goal progress retrieved successfully",
  "data": {
    "goalId": "goal-uuid",
    "title": "Complete Project X",
    "currentValue": 25,
    "targetValue": 100,
    "percentage": 25,
    "status": "active",
    "milestones": [
      {
        "id": "milestone-uuid-1",
        "title": "Research phase",
        "isCompleted": true,
        "targetValue": null,
        "dueDate": "2025-06-20T00:00:00.000Z"
      },
      {
        "id": "milestone-uuid-2",
        "title": "Design phase",
        "isCompleted": false,
        "targetValue": null,
        "dueDate": "2025-06-30T00:00:00.000Z"
      }
    ]
  }
}
```

### Create Milestone

Create a new milestone for a goal.

**URL**: `POST /api/v1/goals/:goalId/milestones`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| goalId | Goal UUID |

**Request Body**:

```json
{
  "title": "Complete design phase",
  "description": "Finalize all design components",
  "targetValue": 100,
  "dueDate": "2025-06-20T00:00:00.000Z"
}
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| title | string | Milestone title | Yes |
| description | string | Detailed description | No |
| targetValue | number | Target numerical value | No |
| dueDate | ISO date | Due date for the milestone | No |

**Success Response**:

- **Code**: 201 Created
- **Content**:

```json
{
  "success": true,
  "message": "Milestone created successfully",
  "data": {
    "id": "milestone-uuid",
    "goalId": "goal-uuid",
    "title": "Complete design phase",
    "description": "Finalize all design components",
    "targetValue": 100,
    "isCompleted": false,
    "dueDate": "2025-06-20T00:00:00.000Z",
    "completedAt": null,
    "createdAt": "2025-06-08T04:05:10.123Z",
    "updatedAt": "2025-06-08T04:05:10.123Z"
  }
}
```

### Update Milestone

Update an existing milestone.

**URL**: `PUT /api/v1/goals/:goalId/milestones/:milestoneId`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| goalId | Goal UUID |
| milestoneId | Milestone UUID |

**Request Body**:

```json
{
  "title": "Updated design phase",
  "description": "Updated description",
  "targetValue": 100,
  "isCompleted": true,
  "dueDate": "2025-06-25T00:00:00.000Z"
}
```

All fields are optional. Only include fields you wish to update.

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Milestone updated successfully",
  "data": {
    "id": "milestone-uuid",
    "goalId": "goal-uuid",
    "title": "Updated design phase",
    "description": "Updated description",
    "targetValue": 100,
    "isCompleted": true,
    "dueDate": "2025-06-25T00:00:00.000Z",
    "completedAt": "2025-06-08T04:25:30.789Z",
    "createdAt": "2025-06-08T04:05:10.123Z",
    "updatedAt": "2025-06-08T04:25:30.789Z"
  }
}
```

### Delete Milestone

Delete a milestone by its ID.

**URL**: `DELETE /api/v1/goals/:goalId/milestones/:milestoneId`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| goalId | Goal UUID |
| milestoneId | Milestone UUID |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Milestone deleted successfully"
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
  "message": "Goal not found"
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