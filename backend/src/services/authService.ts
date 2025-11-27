import jwt, { Secret } from 'jsonwebtoken';
import { CustomJwtPayload } from '../models/types';

const JWT_SECRET: Secret = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_SECRET must be set in production environment');
    }
    console.warn('WARNING: Using default JWT_SECRET in development. Set JWT_SECRET in production!');
    return 'default-secret-change-in-production';
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  return secret;
})();
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d');

export const authService = {
  /**
   * Generate a JWT token for the authenticated user
   */
  generateToken(payload: CustomJwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    } as jwt.SignOptions);
  },

  /**
   * Verify and decode a JWT token
   */
  verifyToken(token: string): CustomJwtPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as CustomJwtPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  },

  /**
   * Get token expiration time in milliseconds
   */
  getTokenExpiration(): number {
    const expiresIn = JWT_EXPIRES_IN;
    
    // Parse duration string (e.g., '7d', '24h', '60m')
    const match = expiresIn.match(/^(\d+)([dhms])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'm': return value * 60 * 1000;
      case 's': return value * 1000;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  }
};

