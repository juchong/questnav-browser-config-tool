import express from 'express';
import { logDb } from '../services/database';
import { requireAuth } from '../middleware/auth';
import { ExecutionLog, ApiResponse } from '../models/types';

const router = express.Router();

// Create execution log (called from frontend)
router.post('/', (req, res) => {
  try {
    const { profile_id, status, error_message } = req.body;

    if (!profile_id || typeof profile_id !== 'number') {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid profile_id'
      };
      return res.status(400).json(response);
    }

    if (!status || !['success', 'failure', 'partial'].includes(status)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid status'
      };
      return res.status(400).json(response);
    }

    const log = logDb.create({ profile_id, status, error_message });
    const response: ApiResponse<ExecutionLog> = {
      success: true,
      data: log
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

// Get all logs (admin)
router.get('/admin', requireAuth, (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const logs = logDb.getAll(limit);
    const response: ApiResponse<ExecutionLog[]> = {
      success: true,
      data: logs
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

// Get logs for specific profile (admin)
router.get('/admin/profile/:profileId', requireAuth, (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId);
    if (isNaN(profileId)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid profile ID'
      };
      return res.status(400).json(response);
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const logs = logDb.getByProfileId(profileId, limit);
    const response: ApiResponse<ExecutionLog[]> = {
      success: true,
      data: logs
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

// Get statistics (admin)
router.get('/admin/stats', requireAuth, (req, res) => {
  try {
    const stats = logDb.getStats();
    const response: ApiResponse = {
      success: true,
      data: stats
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

