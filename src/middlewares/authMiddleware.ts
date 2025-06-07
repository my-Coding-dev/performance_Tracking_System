import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';
import logger from '../utils/logger';

// Extend the Express Request interface to include the user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware to authenticate and authorize users
 */
class AuthMiddleware {
  /**
   * Authenticate user
   */
  authenticate(req: Request, res: Response, next: NextFunction): void {
    try {
      // Get token from header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized - No token provided',
        });
        return;
      }
      
      const token = authHeader.split(' ')[1];
      
      // Verify token
      const decoded = authService.verifyToken(token);
      
      // Set user in request
      req.user = decoded;
      
      next();
    } catch (error) {
      logger.error('Authentication error', error instanceof Error ? error : new Error(String(error)));
      res.status(401).json({
        success: false,
        message: 'Unauthorized - Invalid token',
      });
    }
  }
  
  /**
   * Authorize user based on role
   */
  authorize(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          res.status(401).json({
            success: false,
            message: 'Unauthorized - Please authenticate',
          });
          return;
        }
        
        if (roles.length > 0 && !roles.includes(req.user.role)) {
          res.status(403).json({
            success: false,
            message: 'Forbidden - You do not have permission to access this resource',
          });
          return;
        }
        
        next();
      } catch (error) {
        logger.error('Authorization error', error instanceof Error ? error : new Error(String(error)));
        res.status(500).json({
          success: false,
          message: 'Internal server error',
        });
      }
    };
  }
}

export default new AuthMiddleware(); 