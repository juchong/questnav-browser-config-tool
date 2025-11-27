/**
 * APK Routes
 * Serves cached APK files to frontend
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { getApkPath, verifyApk, listCachedApks, downloadAndCacheApk } from '../services/apkService';
import { apkReleaseDb } from '../services/database';
import { ApiResponse } from '../models/types';
import { sanitizeString } from '../utils/sanitization';

const router = express.Router();

// Stricter rate limiting for APK cache endpoint
// More lenient in development
const apkCacheLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 100 : 10, // 100 in dev, 10 in prod
  message: { success: false, error: 'Too many APK download requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for APK status checks
const apkStatusLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: process.env.NODE_ENV === 'development' ? 200 : 20, // 200 in dev, 20 in prod
  message: { success: false, error: 'Too many status check requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Allowed domains for APK downloads
const ALLOWED_APK_DOMAINS = [
  'github.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com'
];

/**
 * Validate APK URL against whitelist
 */
function isValidApkUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Check protocol
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }
    
    // Check domain whitelist
    const hostname = parsed.hostname.toLowerCase();
    const isAllowed = ALLOWED_APK_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
    
    if (!isAllowed) {
      return { 
        valid: false, 
        error: `Domain not allowed. Allowed domains: ${ALLOWED_APK_DOMAINS.join(', ')}` 
      };
    }
    
    // Check file extension
    if (!parsed.pathname.toLowerCase().endsWith('.apk')) {
      return { valid: false, error: 'URL must point to an APK file' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// Get available APK releases (public endpoint for users)
// Returns only completed releases with necessary info for version selection
router.get('/releases/available', (req, res) => {
  try {
    const releases = apkReleaseDb.getAll()
      .filter(r => r.download_status === 'completed' && r.apk_hash)
      .map(r => ({
        release_tag: r.release_tag,
        apk_name: r.apk_name,
        apk_hash: r.apk_hash,
        apk_size: r.apk_size,
        published_at: r.published_at
      }))
      .sort((a, b) => {
        // Sort by published date, newest first
        const dateA = new Date(a.published_at || 0).getTime();
        const dateB = new Date(b.published_at || 0).getTime();
        return dateB - dateA;
      });
    
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

// Download and cache APK from URL (for user toggle QuestNav)
// This is a public endpoint so users can trigger QuestNav download
// Protected with strict rate limiting and URL whitelist
router.post('/cache', apkCacheLimiter, async (req, res) => {
  try {
    const { apk_url, apk_name } = req.body;
    
    if (!apk_url || !apk_name) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing apk_url or apk_name'
      };
      return res.status(400).json(response);
    }
    
    // Validate URL
    const urlValidation = isValidApkUrl(apk_url);
    if (!urlValidation.valid) {
      const response: ApiResponse = {
        success: false,
        error: urlValidation.error || 'Invalid APK URL'
      };
      return res.status(400).json(response);
    }
    
    // Validate and sanitize name
    if (typeof apk_name !== 'string' || apk_name.length === 0 || apk_name.length > 255) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid APK name (must be 1-255 characters)'
      };
      return res.status(400).json(response);
    }
    
    // Sanitize the APK name to prevent path traversal
    const sanitizedApkName = sanitizeString(apk_name, 255).replace(/[\/\\]/g, '_');
    
    // Download and cache with sanitized name
    const result = await downloadAndCacheApk(apk_url, sanitizedApkName);
    
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

// Check APK status by release tag (public endpoint)
// Only checks database, doesn't trigger downloads
router.get('/status/:releaseTag', apkStatusLimiter, (req, res) => {
  try {
    const releaseTag = sanitizeString(req.params.releaseTag, 100);
    
    if (!releaseTag) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid release tag'
      };
      return res.status(400).json(response);
    }
    
    // Look up release in database
    const release = apkReleaseDb.getByTag(releaseTag);
    
    if (release && release.download_status === 'completed' && release.apk_hash) {
      const response: ApiResponse = {
        success: true,
        data: {
          cached: true,
          hash: release.apk_hash,
          size: release.apk_size,
          release_tag: release.release_tag,
          apk_name: release.apk_name
        }
      };
      res.json(response);
    } else {
      const response: ApiResponse = {
        success: true,
        data: {
          cached: false,
          release_tag: releaseTag
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

// List all cached APKs (public - users need to see available APKs)
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

