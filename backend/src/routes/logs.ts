import express from 'express';
import { logDb } from '../services/database';
import { requireAuth } from '../middleware/auth';
import { ExecutionLog, ApiResponse } from '../models/types';
import { processCommandResults } from '../services/commandProcessor';

const router = express.Router();

// Create execution log (called from frontend)
router.post('/', (req, res) => {
  try {
    const { 
      profile_id, 
      status, 
      error_message,
      device_serial,
      device_name,
      connection_timestamp,
      execution_start_timestamp,
      execution_end_timestamp,
      command_results,
      total_commands,
      successful_commands,
      failed_commands,
      // Browser information
      browser_name,
      browser_version,
      browser_engine,
      os_name,
      os_version,
      platform,
      screen_resolution,
      viewport_size,
      timezone,
      language,
      webusb_supported,
      browser_fingerprint
    } = req.body;

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

    // Extract client metadata from request
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Calculate execution duration if timestamps provided
    let executionDurationMs: number | undefined;
    if (execution_start_timestamp && execution_end_timestamp) {
      const startTime = new Date(execution_start_timestamp).getTime();
      const endTime = new Date(execution_end_timestamp).getTime();
      executionDurationMs = endTime - startTime;
    }

    // Process command results (applies special handling for diagnostic commands)
    const processedResults = command_results ? processCommandResults(command_results) : undefined;

    // Build log entry with all available data
    const logEntry: ExecutionLog = {
      profile_id,
      status,
      error_message,
      client_ip: clientIp,
      user_agent: userAgent,
      device_serial,
      device_name,
      connection_timestamp,
      execution_start_timestamp,
      execution_end_timestamp,
      execution_duration_ms: executionDurationMs,
      command_results: processedResults, // Use processed results
      total_commands,
      successful_commands,
      failed_commands,
      // Browser information
      browser_name,
      browser_version,
      browser_engine,
      os_name,
      os_version,
      platform,
      screen_resolution,
      viewport_size,
      timezone,
      language,
      webusb_supported,
      browser_fingerprint
    };

    const log = logDb.create(logEntry);
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

// Get specific log by ID with full details (admin)
router.get('/admin/:id', requireAuth, (req, res) => {
  try {
    const logId = parseInt(req.params.id);
    if (isNaN(logId)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid log ID'
      };
      return res.status(400).json(response);
    }

    const log = logDb.getById(logId);
    if (!log) {
      const response: ApiResponse = {
        success: false,
        error: 'Log not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<ExecutionLog> = {
      success: true,
      data: log
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

// Get logs by device serial (admin)
router.get('/admin/device/:serial', requireAuth, (req, res) => {
  try {
    const deviceSerial = req.params.serial;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    
    const logs = logDb.getByDeviceSerial(deviceSerial, limit);
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

// Get unique devices that have connected (admin)
router.get('/admin/devices', requireAuth, (req, res) => {
  try {
    const devices = logDb.getUniqueDevices();
    const response: ApiResponse = {
      success: true,
      data: devices
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

