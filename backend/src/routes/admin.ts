import express from 'express';
import { profileDb, apkReleaseDb } from '../services/database';
import { downloadAndCacheApk, deleteApk } from '../services/apkService';
import { triggerManualDownload } from '../services/webhookService';
import { backfillReleases, getBackfillStatus } from '../services/releaseBackfillService';
import { requireAuth } from '../middleware/auth';
import { ConfigProfile, ApiResponse, AdbCommand } from '../models/types';

const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(requireAuth);

// Validate ADB command structure
function validateCommand(cmd: any): cmd is AdbCommand {
  const validCategories = ['refresh_rate', 'performance', 'display', 'privacy', 'system', 'diagnostic', 'app_install'];
  
  if (typeof cmd !== 'object' || 
      typeof cmd.command !== 'string' || 
      cmd.command.length === 0 ||
      typeof cmd.description !== 'string' ||
      !validCategories.includes(cmd.category)) {
    return false;
  }

  // Additional validation for app_install category
  if (cmd.category === 'app_install') {
    if (!cmd.apk_url || typeof cmd.apk_url !== 'string' || cmd.apk_url.length === 0) {
      return false;
    }
    if (!cmd.apk_name || typeof cmd.apk_name !== 'string' || cmd.apk_name.length === 0) {
      return false;
    }
    // Validate URL format
    try {
      new URL(cmd.apk_url);
    } catch {
      return false;
    }
  }

  return true;
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

// Get all profiles (admin only)
router.get('/profiles', (req, res) => {
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

// Set active profile (admin only)
router.put('/profiles/:id/activate', (req, res) => {
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
    const profile = profileDb.getById(id);
    if (!profile) {
      const response: ApiResponse = {
        success: false,
        error: 'Profile not found'
      };
      return res.status(404).json(response);
    }

    const success = profileDb.setActive(id);
    if (!success) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to set profile as active'
      };
      return res.status(500).json(response);
    }

    const response: ApiResponse<ConfigProfile> = {
      success: true,
      data: profileDb.getById(id)
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

// Create new profile
router.post('/profiles', async (req, res) => {
  try {
    const validation = validateProfile(req.body);
    if (!validation.valid) {
      const response: ApiResponse = {
        success: false,
        error: validation.error
      };
      return res.status(400).json(response);
    }

    // Note: APKs are NOT downloaded automatically
    // Admin must manually trigger download via "Download APK" button
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
router.put('/profiles/:id', async (req, res) => {
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

    // Note: APKs are NOT downloaded automatically
    // Admin must manually trigger download via "Download APK" button
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

// ====== APK Release Management ======

// Get all APK releases
router.get('/apk-releases', (req, res) => {
  try {
    const releases = apkReleaseDb.getAll();
    const response: ApiResponse = {
      success: true,
      data: releases
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

// Get latest completed APK release
router.get('/apk-releases/latest', (req, res) => {
  try {
    const release = apkReleaseDb.getLatestCompleted();
    const response: ApiResponse = {
      success: true,
      data: release || null
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

// Manually trigger download for a release
router.post('/apk-releases/:id/download', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid release ID'
      };
      return res.status(400).json(response);
    }

    const result = await triggerManualDownload(id);
    if (result.success) {
      const response: ApiResponse = {
        success: true,
        data: { message: result.message }
      };
      res.json(response);
    } else {
      const response: ApiResponse = {
        success: false,
        error: result.message
      };
      res.status(400).json(response);
    }
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Delete APK release and cached file
router.delete('/apk-releases/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid release ID'
      };
      return res.status(400).json(response);
    }

    // Get release to find hash
    const release = apkReleaseDb.getById(id);
    if (!release) {
      const response: ApiResponse = {
        success: false,
        error: 'Release not found'
      };
      return res.status(404).json(response);
    }

    // Delete cached APK file if it exists
    if (release.apk_hash) {
      deleteApk(release.apk_hash);
    }

    // Delete database entry
    const success = apkReleaseDb.delete(id);
    if (!success) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to delete release'
      };
      return res.status(500).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: { message: 'Release and cached APK deleted' }
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

// Manually register a new release (for manual download from admin panel)
router.post('/apk-releases', async (req, res) => {
  try {
    const { release_tag, release_name, apk_name, apk_url } = req.body;

    // Validation
    if (!release_tag || !apk_name || !apk_url) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing required fields: release_tag, apk_name, apk_url'
      };
      return res.status(400).json(response);
    }

    // Validate URL
    try {
      new URL(apk_url);
    } catch {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid APK URL'
      };
      return res.status(400).json(response);
    }

    // Check if already exists
    if (apkReleaseDb.exists(release_tag)) {
      const response: ApiResponse = {
        success: false,
        error: 'Release with this tag already exists'
      };
      return res.status(400).json(response);
    }

    // Create release entry
    const newRelease = apkReleaseDb.create({
      release_tag,
      release_name: release_name || release_tag,
      apk_name,
      apk_url,
      download_status: 'pending',
      source: 'manual'
    });

    // Trigger download
    const downloadResult = await triggerManualDownload(newRelease.id!);

    const response: ApiResponse = {
      success: true,
      data: {
        release: newRelease,
        download: downloadResult
      }
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

// Backfill historical releases from GitHub
router.post('/apk-releases/backfill', async (req, res) => {
  try {
    const { maxReleases = 30, autoDownload = false } = req.body;

    // Validate parameters
    if (typeof maxReleases !== 'number' || maxReleases < 1 || maxReleases > 100) {
      const response: ApiResponse = {
        success: false,
        error: 'maxReleases must be between 1 and 100'
      };
      return res.status(400).json(response);
    }

    // Run backfill
    const result = await backfillReleases({ maxReleases, autoDownload });

    if (result.success) {
      const response: ApiResponse = {
        success: true,
        data: result
      };
      res.json(response);
    } else {
      const response: ApiResponse = {
        success: false,
        error: result.message
      };
      res.status(500).json(response);
    }
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Get backfill status
router.get('/apk-releases/backfill-status', (req, res) => {
  try {
    const status = getBackfillStatus();
    const response: ApiResponse = {
      success: true,
      data: status
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

