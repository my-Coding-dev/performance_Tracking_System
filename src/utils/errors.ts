/**
 * Custom error classes for the application
 */

/**
 * Base class for all application errors
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Indicates this is an expected error that can be handled gracefully

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request - The request could not be understood or was missing required parameters
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request') {
    super(message, 400);
  }
}

/**
 * 401 Unauthorized - Authentication is required and has failed or has not been provided
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * 403 Forbidden - The server understood the request but refuses to authorize it
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * 404 Not Found - The requested resource could not be found
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found') {
    super(message, 404);
  }
}

/**
 * 409 Conflict - The request could not be completed due to a conflict with the current state of the resource
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409);
  }
}

/**
 * 422 Unprocessable Entity - The request was well-formed but was unable to be followed due to semantic errors
 */
export class ValidationError extends AppError {
  errors?: Record<string, string>;

  constructor(message: string = 'Validation Error', errors?: Record<string, string>) {
    super(message, 422);
    this.errors = errors;
  }
}

/**
 * 429 Too Many Requests - The user has sent too many requests in a given amount of time
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too Many Requests') {
    super(message, 429);
  }
}

/**
 * 500 Internal Server Error - A generic error occurred on the server
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500);
  }
}

/**
 * 503 Service Unavailable - The server is currently unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service Unavailable') {
    super(message, 503);
  }
}

/**
 * Error handler middleware for Express
 */
export const errorHandler = (err: any, req: any, res: any, next: any) => {
  // Log error
  console.error('Error:', err);

  // If it's an operational error, send the defined status code and message
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err instanceof ValidationError ? err.errors : undefined
    });
  }

  // For other errors, send 500 Internal Server Error
  return res.status(500).json({
    success: false,
    message: 'Something went wrong'
  });
}; 