# Finance API Documentation

This document provides detailed information about the Finance API endpoints available in the Performance Tracking System.

## Authentication

All endpoints require authentication. Include a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Base URL

```
/api/v1/finance
```

## Endpoints

### Create an Account

Create a new financial account for tracking balances and transactions.

**URL**: `POST /api/v1/finance/accounts`

**Auth required**: Yes

**Request Body**:

```json
{
  "name": "Primary Checking",
  "accountType": "checking",
  "balance": 1500.00,
  "currency": "USD",
  "includeInTotal": true,
  "institution": "Bank of America",
  "accountNumber": "XXXX4321",
  "notes": "Main personal checking account"
}
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| name | string | Account name | Yes |
| accountType | string | Account type (checking, savings, credit, investment, cash) | Yes |
| balance | number | Current account balance | Yes |
| currency | string | Currency code (default: USD) | No |
| includeInTotal | boolean | Whether to include in net worth calculations | No |
| institution | string | Financial institution name | No |
| accountNumber | string | Last 4 digits or masked account number | No |
| notes | string | Additional notes about the account | No |

**Success Response**:

- **Code**: 201 Created
- **Content**:

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "id": "account-uuid",
    "userId": "user-uuid",
    "name": "Primary Checking",
    "accountType": "checking",
    "balance": 1500.00,
    "currency": "USD",
    "isActive": true,
    "includeInTotal": true,
    "institution": "Bank of America",
    "accountNumber": "XXXX4321",
    "notes": "Main personal checking account",
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
    "name": "Name is required",
    "accountType": "Account type is required",
    "balance": "Balance is required"
  }
}
```

### Get All Accounts

Retrieve all accounts for the current user.

**URL**: `GET /api/v1/finance/accounts`

**Auth required**: Yes

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Accounts retrieved successfully",
  "data": [
    {
      "id": "account-uuid-1",
      "userId": "user-uuid",
      "name": "Primary Checking",
      "accountType": "checking",
      "balance": 1500.00,
      "currency": "USD",
      "isActive": true,
      "includeInTotal": true,
      "institution": "Bank of America",
      "accountNumber": "XXXX4321",
      "notes": "Main personal checking account",
      "createdAt": "2025-06-08T04:05:10.123Z",
      "updatedAt": "2025-06-08T04:05:10.123Z"
    },
    {
      "id": "account-uuid-2",
      "userId": "user-uuid",
      "name": "Savings",
      "accountType": "savings",
      "balance": 5000.00,
      "currency": "USD",
      "isActive": true,
      "includeInTotal": true,
      "institution": "Bank of America",
      "accountNumber": "XXXX8765",
      "notes": "Emergency fund",
      "createdAt": "2025-06-08T04:05:10.123Z",
      "updatedAt": "2025-06-08T04:05:10.123Z"
    }
  ]
}
```

### Get Account by ID

Retrieve a specific account by its ID.

**URL**: `GET /api/v1/finance/accounts/:id`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| id | Account UUID |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Account retrieved successfully",
  "data": {
    "id": "account-uuid",
    "userId": "user-uuid",
    "name": "Primary Checking",
    "accountType": "checking",
    "balance": 1500.00,
    "currency": "USD",
    "isActive": true,
    "includeInTotal": true,
    "institution": "Bank of America",
    "accountNumber": "XXXX4321",
    "notes": "Main personal checking account",
    "createdAt": "2025-06-08T04:05:10.123Z",
    "updatedAt": "2025-06-08T04:05:10.123Z",
    "transactions": [
      {
        "id": "transaction-uuid",
        "amount": -50.00,
        "description": "Grocery shopping",
        "date": "2025-06-05T00:00:00.000Z",
        "type": "EXPENSE",
        "category": "Food"
      }
    ]
  }
}
```

### Update Account

Update an existing account.

**URL**: `PUT /api/v1/finance/accounts/:id`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| id | Account UUID |

**Request Body**:

```json
{
  "name": "Updated Checking",
  "accountType": "checking",
  "balance": 1750.50,
  "currency": "USD",
  "isActive": true,
  "includeInTotal": true,
  "institution": "Bank of America",
  "accountNumber": "XXXX4321",
  "notes": "Updated notes"
}
```

All fields are optional. Only include fields you wish to update.

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Account updated successfully",
  "data": {
    "id": "account-uuid",
    "userId": "user-uuid",
    "name": "Updated Checking",
    "accountType": "checking",
    "balance": 1750.50,
    "currency": "USD",
    "isActive": true,
    "includeInTotal": true,
    "institution": "Bank of America",
    "accountNumber": "XXXX4321",
    "notes": "Updated notes",
    "createdAt": "2025-06-08T04:05:10.123Z",
    "updatedAt": "2025-06-08T04:15:20.456Z"
  }
}
```

### Delete Account

Delete an account by its ID.

**URL**: `DELETE /api/v1/finance/accounts/:id`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| id | Account UUID |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

### Create a Transaction

Create a new financial transaction.

**URL**: `POST /api/v1/finance/transactions`

**Auth required**: Yes

**Request Body**:

```json
{
  "accountId": "account-uuid",
  "amount": -50.00,
  "description": "Grocery shopping",
  "date": "2025-06-05T00:00:00.000Z",
  "type": "EXPENSE",
  "category": "Food",
  "subcategory": "Groceries",
  "isRecurring": false,
  "recurrenceRule": null,
  "transferToId": null,
  "status": "cleared",
  "tags": ["essential", "monthly"],
  "notes": "Weekly grocery shopping"
}
```

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| accountId | string | Account UUID | Yes |
| amount | number | Transaction amount (negative for expenses) | Yes |
| description | string | Transaction description | Yes |
| date | ISO date | Transaction date | Yes |
| type | string | Transaction type (INCOME, EXPENSE, TRANSFER) | Yes |
| category | string | Transaction category | No |
| subcategory | string | Transaction subcategory | No |
| isRecurring | boolean | Whether this is a recurring transaction | No |
| recurrenceRule | string | RRULE format for recurring transactions | No |
| transferToId | string | Destination account ID for transfers | No |
| status | string | Transaction status (pending, cleared, reconciled) | No |
| tags | array | Array of tags for categorization | No |
| notes | string | Additional notes about the transaction | No |

**Success Response**:

- **Code**: 201 Created
- **Content**:

```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "id": "transaction-uuid",
    "userId": "user-uuid",
    "accountId": "account-uuid",
    "amount": -50.00,
    "description": "Grocery shopping",
    "date": "2025-06-05T00:00:00.000Z",
    "type": "EXPENSE",
    "category": "Food",
    "subcategory": "Groceries",
    "isRecurring": false,
    "recurrenceRule": null,
    "transferToId": null,
    "transferFromId": null,
    "status": "cleared",
    "tags": ["essential", "monthly"],
    "notes": "Weekly grocery shopping",
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
    "accountId": "Account is required",
    "amount": "Amount is required",
    "description": "Description is required",
    "date": "Date is required",
    "type": "Transaction type is required"
  }
}
```

### Get All Transactions

Retrieve all transactions for the current user with filtering and pagination.

**URL**: `GET /api/v1/finance/transactions`

**Auth required**: Yes

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| accountId | string | Filter by account ID |
| type | string/array | Filter by transaction type |
| dateFrom | ISO date | Filter transactions after this date |
| dateTo | ISO date | Filter transactions before this date |
| categories | array | Filter by categories |
| search | string | Search in description |
| isRecurring | boolean | Filter by recurring status |
| tags | array | Filter by tags |
| minAmount | number | Filter by minimum amount |
| maxAmount | number | Filter by maximum amount |
| sortBy | string | Field to sort by (date, amount, etc.) |
| sortOrder | string | Sort order (asc or desc) |
| page | number | Page number for pagination (default: 1) |
| limit | number | Number of items per page (default: 20) |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Transactions retrieved successfully",
  "data": {
    "transactions": [
      {
        "id": "transaction-uuid-1",
        "userId": "user-uuid",
        "accountId": "account-uuid",
        "amount": -50.00,
        "description": "Grocery shopping",
        "date": "2025-06-05T00:00:00.000Z",
        "type": "EXPENSE",
        "category": "Food",
        "subcategory": "Groceries",
        "isRecurring": false,
        "recurrenceRule": null,
        "transferToId": null,
        "transferFromId": null,
        "status": "cleared",
        "tags": ["essential", "monthly"],
        "notes": "Weekly grocery shopping",
        "createdAt": "2025-06-08T04:05:10.123Z",
        "updatedAt": "2025-06-08T04:05:10.123Z",
        "account": {
          "id": "account-uuid",
          "name": "Primary Checking"
        }
      },
      {
        "id": "transaction-uuid-2",
        "userId": "user-uuid",
        "accountId": "account-uuid",
        "amount": 2000.00,
        "description": "Salary deposit",
        "date": "2025-06-01T00:00:00.000Z",
        "type": "INCOME",
        "category": "Income",
        "subcategory": "Salary",
        "isRecurring": true,
        "recurrenceRule": "FREQ=MONTHLY;BYMONTHDAY=1",
        "transferToId": null,
        "transferFromId": null,
        "status": "cleared",
        "tags": ["income", "salary"],
        "notes": "Monthly salary payment",
        "createdAt": "2025-06-08T04:05:10.123Z",
        "updatedAt": "2025-06-08T04:05:10.123Z",
        "account": {
          "id": "account-uuid",
          "name": "Primary Checking"
        }
      }
    ],
    "total": 25,
    "page": 1,
    "limit": 20,
    "totalPages": 2
  }
}
```

### Get Transaction by ID

Retrieve a specific transaction by its ID.

**URL**: `GET /api/v1/finance/transactions/:id`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| id | Transaction UUID |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Transaction retrieved successfully",
  "data": {
    "id": "transaction-uuid",
    "userId": "user-uuid",
    "accountId": "account-uuid",
    "amount": -50.00,
    "description": "Grocery shopping",
    "date": "2025-06-05T00:00:00.000Z",
    "type": "EXPENSE",
    "category": "Food",
    "subcategory": "Groceries",
    "isRecurring": false,
    "recurrenceRule": null,
    "transferToId": null,
    "transferFromId": null,
    "status": "cleared",
    "tags": ["essential", "monthly"],
    "notes": "Weekly grocery shopping",
    "createdAt": "2025-06-08T04:05:10.123Z",
    "updatedAt": "2025-06-08T04:05:10.123Z",
    "account": {
      "id": "account-uuid",
      "name": "Primary Checking",
      "accountType": "checking",
      "currency": "USD"
    }
  }
}
```

### Update Transaction

Update an existing transaction.

**URL**: `PUT /api/v1/finance/transactions/:id`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| id | Transaction UUID |

**Request Body**:

```json
{
  "accountId": "account-uuid",
  "amount": -55.00,
  "description": "Updated grocery shopping",
  "date": "2025-06-05T00:00:00.000Z",
  "type": "EXPENSE",
  "category": "Food",
  "subcategory": "Groceries",
  "isRecurring": false,
  "recurrenceRule": null,
  "transferToId": null,
  "status": "reconciled",
  "tags": ["essential", "monthly", "food"],
  "notes": "Updated notes"
}
```

All fields are optional. Only include fields you wish to update.

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Transaction updated successfully",
  "data": {
    "id": "transaction-uuid",
    "userId": "user-uuid",
    "accountId": "account-uuid",
    "amount": -55.00,
    "description": "Updated grocery shopping",
    "date": "2025-06-05T00:00:00.000Z",
    "type": "EXPENSE",
    "category": "Food",
    "subcategory": "Groceries",
    "isRecurring": false,
    "recurrenceRule": null,
    "transferToId": null,
    "transferFromId": null,
    "status": "reconciled",
    "tags": ["essential", "monthly", "food"],
    "notes": "Updated notes",
    "createdAt": "2025-06-08T04:05:10.123Z",
    "updatedAt": "2025-06-08T04:15:20.456Z"
  }
}
```

### Delete Transaction

Delete a transaction by its ID.

**URL**: `DELETE /api/v1/finance/transactions/:id`

**Auth required**: Yes

**URL Parameters**:

| Parameter | Description |
|-----------|-------------|
| id | Transaction UUID |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Transaction deleted successfully"
}
```

### Get Financial Summary

Get a summary of financial information for the current user.

**URL**: `GET /api/v1/finance/summary`

**Auth required**: Yes

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| period | string | Summary period (month, year, all) |
| dateFrom | ISO date | Start date for custom period |
| dateTo | ISO date | End date for custom period |

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "message": "Financial summary retrieved successfully",
  "data": {
    "netWorth": 6500.00,
    "accounts": {
      "total": 6500.00,
      "byType": {
        "checking": 1500.00,
        "savings": 5000.00,
        "credit": 0.00,
        "investment": 0.00,
        "cash": 0.00
      }
    },
    "income": {
      "total": 2000.00,
      "byCategory": {
        "Salary": 2000.00
      }
    },
    "expenses": {
      "total": 350.00,
      "byCategory": {
        "Food": 150.00,
        "Entertainment": 100.00,
        "Utilities": 100.00
      }
    },
    "cashFlow": 1650.00,
    "savingsRate": 82.5,
    "period": {
      "start": "2025-06-01T00:00:00.000Z",
      "end": "2025-06-30T23:59:59.999Z"
    },
    "topExpenseCategories": [
      {
        "category": "Food",
        "amount": 150.00,
        "percentage": 42.86
      },
      {
        "category": "Entertainment",
        "amount": 100.00,
        "percentage": 28.57
      },
      {
        "category": "Utilities",
        "amount": 100.00,
        "percentage": 28.57
      }
    ],
    "recentTransactions": [
      {
        "id": "transaction-uuid-1",
        "description": "Grocery shopping",
        "amount": -50.00,
        "date": "2025-06-05T00:00:00.000Z",
        "category": "Food"
      },
      {
        "id": "transaction-uuid-2",
        "description": "Salary deposit",
        "amount": 2000.00,
        "date": "2025-06-01T00:00:00.000Z",
        "category": "Income"
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
  "message": "Account not found"
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