import express from 'express';
import { profileDb } from '../services/database';
import { ConfigProfile, ApiResponse } from '../models/types';

const router = express.Router();

// Get active profile (public endpoint for users)
router.get('/', (req, res) => {
  try {
    const activeProfile = profileDb.getActive();
    if (!activeProfile) {
      const response: ApiResponse = {
        success: false,
        error: 'No active profile configured'
      };
      return res.status(404).json(response);
    }
    
    // Debug: Log the commands being sent
    if (process.env.DEBUG_MODE === 'true') {
      console.log('[DEBUG] Active profile commands:', JSON.stringify(activeProfile.commands, null, 2));
    }
    
    // Return as array for backward compatibility with frontend
    const response: ApiResponse<ConfigProfile[]> = {
      success: true,
      data: [activeProfile]
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

// Get count of visible profiles (public endpoint)
router.get('/count', (req, res) => {
  try {
    const visibleProfiles = profileDb.getVisible();
    const response: ApiResponse = {
      success: true,
      data: { count: visibleProfiles.length }
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

// Get profile by ID (kept for logging purposes, but users will only get active profile)
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid profile ID'
      };
      return res.status(400).json(response);
    }

    const profile = profileDb.getById(id);
    if (!profile) {
      const response: ApiResponse = {
        success: false,
        error: 'Profile not found'
      };
      return res.status(404).json(response);
    }

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

export default router;

