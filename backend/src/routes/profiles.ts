import express from 'express';
import { profileDb } from '../services/database';
import { ConfigProfile, ApiResponse } from '../models/types';
import { safeErrorMessage } from '../utils/sanitization';

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
      error: safeErrorMessage(error)
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
      error: safeErrorMessage(error)
    };
    res.status(500).json(response);
  }
});

export default router;

