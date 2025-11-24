import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { CustomJwtPayload } from '../models/types';

// Extend Express Request to include user data
declare global {
  namespace Express {
    interface Request {
      user?: CustomJwtPayload;
    }
  }
}

/**
 * Middleware to protect routes that require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from cookie
    const token = req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Verify token
    const decoded = authService.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Attach user data to request
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

