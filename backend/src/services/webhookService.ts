/**
 * GitHub Webhook Service
 * Handles GitHub release webhook events and triggers APK downloads
 */

import crypto from 'crypto';
import { apkReleaseDb, ApkRelease } from './database';
import { downloadAndCacheApk } from './apkService';

export interface GitHubReleaseWebhook {
  action: string;
  release: {
    tag_name: string;
    name: string;
    published_at: string;
    html_url: string;
    assets: Array<{
      name: string;
      browser_download_url: string;
      size: number;
    }>;
  };
  repository: {
    full_name: string;
  };
}

/**
 * Verify GitHub webhook signature
 */
export function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    return false;
  }

  // GitHub sends signature as 'sha256=<hash>'
  const parts = signature.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedSignature = parts[1];
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(computedSignature)
  );
}

/**
 * Process GitHub release webhook
 */
export async function processReleaseWebhook(webhook: GitHubReleaseWebhook): Promise<{
  success: boolean;
  message: string;
  releaseId?: number;
}> {
  try {
    // Only process 'published' or 'released' actions
    if (webhook.action !== 'published' && webhook.action !== 'released') {
      return {
        success: true,
        message: `Ignored action: ${webhook.action}`
      };
    }

    const { release, repository } = webhook;

    // Verify this is from the QuestNav repository
    const expectedRepo = process.env.QUESTNAV_REPO || 'QuestNav/QuestNav';
    if (repository.full_name !== expectedRepo) {
      return {
        success: false,
        message: `Ignored: Not from expected repository (got ${repository.full_name}, expected ${expectedRepo})`
      };
    }

    // Check if release already exists
    if (apkReleaseDb.exists(release.tag_name)) {
      console.log(`Release ${release.tag_name} already tracked`);
      return {
        success: true,
        message: `Release ${release.tag_name} already exists`
      };
    }

    // Find APK asset
    const apkAsset = release.assets.find(asset => asset.name.endsWith('.apk'));
    if (!apkAsset) {
      return {
        success: false,
        message: 'No APK file found in release assets'
      };
    }

    console.log(`New QuestNav release detected: ${release.tag_name}`);
    console.log(`APK: ${apkAsset.name} (${apkAsset.size} bytes)`);

    // Create database entry
    const newRelease = apkReleaseDb.create({
      release_tag: release.tag_name,
      release_name: release.name || release.tag_name,
      apk_name: apkAsset.name,
      apk_url: apkAsset.browser_download_url,
      download_status: 'pending',
      published_at: release.published_at,
      source: 'webhook'
    });

    // Trigger background download (don't await to return quickly)
    downloadApkInBackground(newRelease.id!);

    return {
      success: true,
      message: `Release ${release.tag_name} registered, download initiated`,
      releaseId: newRelease.id
    };
  } catch (error) {
    console.error('Error processing release webhook:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Download APK in background
 */
async function downloadApkInBackground(releaseId: number): Promise<void> {
  try {
    const release = apkReleaseDb.getById(releaseId);
    if (!release) {
      console.error(`Release ${releaseId} not found`);
      return;
    }

    // Update status to downloading
    apkReleaseDb.update(releaseId, { download_status: 'downloading' });
    console.log(`Starting download for ${release.release_tag}...`);

    // Download and cache APK
    const result = await downloadAndCacheApk(release.apk_url, release.apk_name);

    if (result.success) {
      // Update with success
      apkReleaseDb.update(releaseId, {
        download_status: 'completed',
        apk_hash: result.hash,
        apk_size: result.size,
        downloaded_at: new Date().toISOString(),
        download_error: undefined
      });
      console.log(`✓ Download completed for ${release.release_tag} (hash: ${result.hash})`);
    } else {
      // Update with failure
      apkReleaseDb.update(releaseId, {
        download_status: 'failed',
        download_error: result.error
      });
      console.error(`✗ Download failed for ${release.release_tag}: ${result.error}`);
    }
  } catch (error) {
    console.error(`Error in background download for release ${releaseId}:`, error);
    apkReleaseDb.update(releaseId, {
      download_status: 'failed',
      download_error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Manually trigger download for a release
 */
export async function triggerManualDownload(releaseId: number): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const release = apkReleaseDb.getById(releaseId);
    if (!release) {
      return {
        success: false,
        message: 'Release not found'
      };
    }

    if (release.download_status === 'downloading') {
      return {
        success: false,
        message: 'Download already in progress'
      };
    }

    // Reset status and trigger download
    apkReleaseDb.update(releaseId, {
      download_status: 'pending',
      download_error: undefined
    });

    downloadApkInBackground(releaseId);

    return {
      success: true,
      message: 'Download initiated'
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

