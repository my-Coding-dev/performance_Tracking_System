import { Request, Response, NextFunction } from 'express';
import { unauthorized } from '../utils/errorHandler';

// Extended Request interface to include user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Authentication middleware
 * This is a placeholder implementation - in a real app, you would
 * verify JWT tokens, session cookies, or other authentication methods
 */
export const authenticate = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return next(unauthorized('Authentication token required'));
    }
    
    // In a real implementation, you would verify the token
    // For example: const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // For demonstration purposes, we're just setting a placeholder user
    req.user = {
      id: 'placeholder-id',
      email: 'placeholder@example.com',
      role: 'user'
    };
    
    next();
  } catch (error) {
    next(unauthorized('Invalid authentication token'));
  }
};

/**
 * Authorization middleware - check if user has required role
 */
export const authorize = (roles: string[] = ['admin']) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(unauthorized('Authentication required'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(unauthorized('Insufficient permissions'));
    }
    
    next();
  };
};

export default { authenticate, authorize }; 