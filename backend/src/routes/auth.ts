import express from 'express';
import rateLimit from 'express-rate-limit';
import { adminUserDb } from '../services/database';
import { authService } from '../services/authService';
import { requireAuth } from '../middleware/auth';
import { AuthResponse } from '../models/types';

const router = express.Router();

// Rate limiter for login attempts
// More lenient in development
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 50 : 5, // 50 in dev, 5 in prod
  message: { success: false, error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login endpoint
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      const response: AuthResponse = {
        success: false,
        error: 'Username and password are required'
      };
      return res.status(400).json(response);
    }

    // Verify credentials
    const isValid = await adminUserDb.verifyPassword(username, password);

    if (!isValid) {
      const response: AuthResponse = {
        success: false,
        error: 'Invalid username or password'
      };
      return res.status(401).json(response);
    }

    // Get user data
    const user = adminUserDb.getByUsername(username);
    if (!user) {
      const response: AuthResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(401).json(response);
    }

    // Generate JWT token
    const token = authService.generateToken({
      userId: user.id!,
      username: user.username
    });

    // Set httpOnly cookie with secure settings
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isProduction, // HTTPS only in production
      sameSite: isProduction ? 'strict' : 'lax', // Strict in production, lax for dev
      maxAge: authService.getTokenExpiration(),
      domain: isProduction ? '.questnav.gg' : undefined // Allow subdomains in production
    });

    const response: AuthResponse = {
      success: true,
      message: 'Login successful'
    };
    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    const response: AuthResponse = {
      success: false,
      error: 'Internal server error'
    };
    res.status(500).json(response);
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    domain: isProduction ? '.questnav.gg' : undefined
  });

  const response: AuthResponse = {
    success: true,
    message: 'Logout successful'
  };
  res.json(response);
});

// Check authentication status
router.get('/status', requireAuth, (req, res) => {
  const response: AuthResponse = {
    success: true,
    message: 'Authenticated'
  };
  res.json(response);
});

export default router;

