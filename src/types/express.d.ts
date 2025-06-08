import 'express';

// Extend Express Request interface
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

// Define AuthenticatedRequest interface with all needed properties
export interface AuthenticatedRequest extends Express.Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
} 