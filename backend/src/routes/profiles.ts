import express from 'express';
import { profileDb } from '../services/database';
import { ConfigProfile, ApiResponse } from '../models/types';

const router = express.Router();

// Get all profiles
router.get('/', (req, res) => {
  try {
    const profiles = profileDb.getAll();
    const response: ApiResponse<ConfigProfile[]> = {
      success: true,
      data: profiles
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

// Get profile by ID
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

