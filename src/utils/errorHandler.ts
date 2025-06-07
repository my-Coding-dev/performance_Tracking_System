import { Response } from 'express';
import config from '../config/config';

/**
 * Custom Error class with status code
 */
export class ApiError extends Error {
  statusCode: number;
  
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle and format API errors
 */
export const handleError = (err: Error | ApiError, res: Response): void => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      stack: config.nodeEnv === 'development' ? err.stack : undefined
    });
    return;
  }
  
  // Generic server error
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: config.nodeEnv === 'production' ? undefined : err.message,
    stack: config.nodeEnv === 'development' ? err.stack : undefined
  });
};

/**
 * Not Found Error helper
 */
export const notFound = (resource: string = 'Resource'): ApiError => {
  return new ApiError(404, `${resource} not found`);
};

/**
 * Bad Request Error helper
 */
export const badRequest = (message: string = 'Bad request'): ApiError => {
  return new ApiError(400, message);
};

/**
 * Unauthorized Error helper
 */
export const unauthorized = (message: string = 'Unauthorized'): ApiError => {
  return new ApiError(401, message);
};

/**
 * Forbidden Error helper
 */
export const forbidden = (message: string = 'Forbidden'): ApiError => {
  return new ApiError(403, message);
};

/**
 * Too Many Requests Error helper
 */
export const tooManyRequests = (message: string = 'Rate limit exceeded'): ApiError => {
  return new ApiError(429, message);
};

/**
 * Server Error helper
 */
export const serverError = (message: string = 'Internal server error'): ApiError => {
  return new ApiError(500, message);
}; 