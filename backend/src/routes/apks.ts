/**
 * APK Routes
 * Serves cached APK files to frontend
 */

import express from 'express';
import { getApkPath, verifyApk, listCachedApks, downloadAndCacheApk } from '../services/apkService';
import { ApiResponse } from '../models/types';

const router = express.Router();

// Download and cache APK from URL (for user toggle QuestNav)
// This is a public endpoint so users can trigger QuestNav download
router.post('/cache', async (req, res) => {
  try {
    const { apk_url, apk_name } = req.body;
    
    if (!apk_url || !apk_name) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing apk_url or apk_name'
      };
      return res.status(400).json(response);
    }
    
    // Download and cache
    const result = await downloadAndCacheApk(apk_url, apk_name);
    
    if (!result.success) {
      const response: ApiResponse = {
        success: false,
        error: result.error || 'Failed to cache APK'
      };
      return res.status(500).json(response);
    }
    
    const response: ApiResponse = {
      success: true,
      data: {
        hash: result.hash,
        size: result.size
      }
    };
    res.json(response);
  } catch (error) {
    console.error('Error caching APK:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Check APK status (returns info if cached, null if not)
router.post('/status', async (req, res) => {
  try {
    const { apk_url, apk_name } = req.body;
    
    if (!apk_url || !apk_name) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing apk_url or apk_name'
      };
      return res.status(400).json(response);
    }
    
    // Compute hash that this URL would have
    // We need to check if it's already cached without downloading
    const result = await downloadAndCacheApk(apk_url, apk_name);
    
    if (result.success) {
      const response: ApiResponse = {
        success: true,
        data: {
          cached: true,
          hash: result.hash,
          size: result.size
        }
      };
      res.json(response);
    } else {
      const response: ApiResponse = {
        success: true,
        data: {
          cached: false
        }
      };
      res.json(response);
    }
  } catch (error) {
    console.error('Error checking APK status:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Serve APK file by hash
router.get('/:hash', (req, res) => {
  try {
    const { hash } = req.params;
    
    // Validate hash format (64 hex characters for SHA256)
    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid hash format'
      };
      return res.status(400).json(response);
    }
    
    // Get APK path
    const filePath = getApkPath(hash);
    if (!filePath) {
      const response: ApiResponse = {
        success: false,
        error: 'APK not found'
      };
      return res.status(404).json(response);
    }
    
    // Verify integrity
    if (!verifyApk(hash)) {
      const response: ApiResponse = {
        success: false,
        error: 'APK verification failed'
      };
      return res.status(500).json(response);
    }
    
    // Serve file
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${hash}.apk"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving APK:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// List all cached APKs (for debugging/admin)
router.get('/', (req, res) => {
  try {
    const apks = listCachedApks();
    const response: ApiResponse = {
      success: true,
      data: apks
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

