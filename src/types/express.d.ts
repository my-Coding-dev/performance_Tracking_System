import { Request } from 'express';

// Extend Express Request interface
declare global {
  namespace Express {
    export interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

// Define AuthenticatedRequest interface with all needed properties
export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
  body: any;
  params: any;
  query: any;
  header(name: string): string | undefined;
} 