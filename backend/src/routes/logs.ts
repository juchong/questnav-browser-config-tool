import express from 'express';
import rateLimit from 'express-rate-limit';
import { logDb, profileDb } from '../services/database';
import { requireAuth } from '../middleware/auth';
import { ExecutionLog, ApiResponse } from '../models/types';
import { processCommandResults } from '../services/commandProcessor';
import { 
  sanitizeString, 
  sanitizeDeviceSerial, 
  sanitizeDeviceName,
  sanitizeBrowserFingerprint,
  sanitizeErrorMessage,
  validateJsonSize,
  validateInteger
} from '../utils/sanitization';

const router = express.Router();

// Stricter rate limiting for log creation (public endpoint)
// More lenient in development for testing
const logCreationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 100 : 5, // 100 in dev, 5 in prod
  message: { success: false, error: 'Too many log submissions. Please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Create execution log (public endpoint - called from frontend)
router.post('/', logCreationLimiter, (req, res) => {
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

    // Validate profile_id
    if (!profile_id || typeof profile_id !== 'number') {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid profile_id'
      };
      return res.status(400).json(response);
    }

    // Validate status
    if (!status || !['success', 'failure', 'partial'].includes(status)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid status'
      };
      return res.status(400).json(response);
    }

    // Validate command counts if provided
    const validatedTotalCommands = total_commands !== undefined ? validateInteger(total_commands, 0, 1000) : undefined;
    const validatedSuccessful = successful_commands !== undefined ? validateInteger(successful_commands, 0, 1000) : undefined;
    const validatedFailed = failed_commands !== undefined ? validateInteger(failed_commands, 0, 1000) : undefined;

    // Validate command_results size (prevent huge JSON payloads)
    if (command_results && !validateJsonSize(command_results, 500000)) { // 500KB max
      const response: ApiResponse = {
        success: false,
        error: 'Command results payload too large'
      };
      return res.status(400).json(response);
    }

    // Extract and sanitize client metadata from request
    const clientIp = sanitizeString((req.ip || req.connection.remoteAddress || 'unknown'), 100);
    const userAgent = sanitizeString((req.headers['user-agent'] || 'unknown'), 500);

    // Calculate execution duration if timestamps provided
    let executionDurationMs: number | undefined;
    if (execution_start_timestamp && execution_end_timestamp) {
      try {
        const startTime = new Date(execution_start_timestamp).getTime();
        const endTime = new Date(execution_end_timestamp).getTime();
        if (!isNaN(startTime) && !isNaN(endTime) && endTime >= startTime) {
          executionDurationMs = endTime - startTime;
        }
      } catch (e) {
        // Invalid timestamps, skip duration calculation
      }
    }

    // Process and sanitize command results
    const processedResults = command_results ? processCommandResults(command_results) : undefined;

    // Sanitize all text inputs
    const sanitizedErrorMessage = error_message ? sanitizeErrorMessage(error_message) : undefined;
    const sanitizedDeviceSerial = device_serial ? sanitizeDeviceSerial(device_serial) : undefined;
    const sanitizedDeviceName = device_name ? sanitizeDeviceName(device_name) : undefined;
    const sanitizedBrowserName = browser_name ? sanitizeString(browser_name, 100) : undefined;
    const sanitizedBrowserVersion = browser_version ? sanitizeString(browser_version, 50) : undefined;
    const sanitizedBrowserEngine = browser_engine ? sanitizeString(browser_engine, 100) : undefined;
    const sanitizedOsName = os_name ? sanitizeString(os_name, 100) : undefined;
    const sanitizedOsVersion = os_version ? sanitizeString(os_version, 50) : undefined;
    const sanitizedPlatform = platform ? sanitizeString(platform, 100) : undefined;
    const sanitizedScreenResolution = screen_resolution ? sanitizeString(screen_resolution, 50) : undefined;
    const sanitizedViewportSize = viewport_size ? sanitizeString(viewport_size, 50) : undefined;
    const sanitizedTimezone = timezone ? sanitizeString(timezone, 100) : undefined;
    const sanitizedLanguage = language ? sanitizeString(language, 50) : undefined;
    const sanitizedFingerprint = browser_fingerprint ? sanitizeBrowserFingerprint(browser_fingerprint) : undefined;

    // Build log entry with sanitized data
    const logEntry: ExecutionLog = {
      profile_id,
      status,
      error_message: sanitizedErrorMessage,
      client_ip: clientIp,
      user_agent: userAgent,
      device_serial: sanitizedDeviceSerial,
      device_name: sanitizedDeviceName,
      connection_timestamp,
      execution_start_timestamp,
      execution_end_timestamp,
      execution_duration_ms: executionDurationMs,
      command_results: processedResults,
      total_commands: validatedTotalCommands ?? undefined,
      successful_commands: validatedSuccessful ?? undefined,
      failed_commands: validatedFailed ?? undefined,
      // Browser information (sanitized)
      browser_name: sanitizedBrowserName,
      browser_version: sanitizedBrowserVersion,
      browser_engine: sanitizedBrowserEngine,
      os_name: sanitizedOsName,
      os_version: sanitizedOsVersion,
      platform: sanitizedPlatform,
      screen_resolution: sanitizedScreenResolution,
      viewport_size: sanitizedViewportSize,
      timezone: sanitizedTimezone,
      language: sanitizedLanguage,
      webusb_supported,
      browser_fingerprint: sanitizedFingerprint
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

