import express from 'express';
import { profileDb } from '../services/database';
import { requireAuth } from '../middleware/auth';
import { ConfigProfile, ApiResponse, AdbCommand } from '../models/types';

const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(requireAuth);

// Validate ADB command structure
function validateCommand(cmd: any): cmd is AdbCommand {
  return (
    typeof cmd === 'object' &&
    typeof cmd.command === 'string' &&
    cmd.command.length > 0 &&
    typeof cmd.description === 'string' &&
    ['refresh_rate', 'performance', 'display', 'privacy', 'system'].includes(cmd.category)
  );
}

// Validate profile data
function validateProfile(data: any): { valid: boolean; error?: string } {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { valid: false, error: 'Profile name is required' };
  }
  if (data.description && typeof data.description !== 'string') {
    return { valid: false, error: 'Description must be a string' };
  }
  if (!Array.isArray(data.commands) || data.commands.length === 0) {
    return { valid: false, error: 'Commands array is required and must not be empty' };
  }
  if (!data.commands.every(validateCommand)) {
    return { valid: false, error: 'Invalid command structure' };
  }
  return { valid: true };
}

// Create new profile
router.post('/profiles', (req, res) => {
  try {
    const validation = validateProfile(req.body);
    if (!validation.valid) {
      const response: ApiResponse = {
        success: false,
        error: validation.error
      };
      return res.status(400).json(response);
    }

    const profile = profileDb.create(req.body as ConfigProfile);
    const response: ApiResponse<ConfigProfile> = {
      success: true,
      data: profile
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Update profile
router.put('/profiles/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid profile ID'
      };
      return res.status(400).json(response);
    }

    // Check if profile exists
    if (!profileDb.getById(id)) {
      const response: ApiResponse = {
        success: false,
        error: 'Profile not found'
      };
      return res.status(404).json(response);
    }

    // Validate update data
    if (req.body.commands) {
      const validation = validateProfile({ ...req.body, name: req.body.name || 'temp' });
      if (!validation.valid) {
        const response: ApiResponse = {
          success: false,
          error: validation.error
        };
        return res.status(400).json(response);
      }
    }

    const profile = profileDb.update(id, req.body);
    const response: ApiResponse<ConfigProfile> = {
      success: true,
      data: profile
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Delete profile
router.delete('/profiles/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid profile ID'
      };
      return res.status(400).json(response);
    }

    const success = profileDb.delete(id);
    if (!success) {
      const response: ApiResponse = {
        success: false,
        error: 'Profile not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

export default router;

