/**
 * Release Backfill Service
 * Fetches historical releases from GitHub API and populates database
 */

import { apkReleaseDb } from './database';

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

export interface BackfillResult {
  success: boolean;
  message: string;
  stats?: {
    total: number;
    added: number;
    skipped: number;
    failed: number;
  };
  releases?: Array<{
    tag: string;
    status: 'added' | 'skipped' | 'failed';
    reason?: string;
  }>;
}

/**
 * Fetch releases from GitHub API
 */
async function fetchGitHubReleases(repo: string, perPage: number = 30): Promise<GitHubRelease[]> {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=${perPage}`, {
      headers: {
        'User-Agent': 'QuestNav-Config-Tool',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as GitHubRelease[];
  } catch (error) {
    console.error('Failed to fetch releases from GitHub:', error);
    throw error;
  }
}

/**
 * Backfill historical releases from GitHub
 */
export async function backfillReleases(options: {
  maxReleases?: number;
  autoDownload?: boolean;
} = {}): Promise<BackfillResult> {
  const { maxReleases = 30, autoDownload = false } = options;
  
  try {
    const repo = process.env.QUESTNAV_REPO || 'QuestNav/QuestNav';
    console.log(`Backfilling releases from ${repo} (max: ${maxReleases}, autoDownload: ${autoDownload})...`);

    // Fetch releases from GitHub
    const githubReleases = await fetchGitHubReleases(repo, maxReleases);
    console.log(`Fetched ${githubReleases.length} releases from GitHub`);

    const stats = {
      total: githubReleases.length,
      added: 0,
      skipped: 0,
      failed: 0
    };

    const releaseResults: Array<{
      tag: string;
      status: 'added' | 'skipped' | 'failed';
      reason?: string;
    }> = [];

    // Process each release
    for (const release of githubReleases) {
      try {
        // Check if already exists
        if (apkReleaseDb.exists(release.tag_name)) {
          console.log(`  - ${release.tag_name}: Already exists (skipped)`);
          stats.skipped++;
          releaseResults.push({
            tag: release.tag_name,
            status: 'skipped',
            reason: 'Already exists'
          });
          continue;
        }

        // Find APK asset
        const apkAsset = release.assets.find(asset => asset.name.endsWith('.apk'));
        if (!apkAsset) {
          console.log(`  - ${release.tag_name}: No APK found (skipped)`);
          stats.skipped++;
          releaseResults.push({
            tag: release.tag_name,
            status: 'skipped',
            reason: 'No APK asset found'
          });
          continue;
        }

        // Create database entry
        const newRelease = apkReleaseDb.create({
          release_tag: release.tag_name,
          release_name: release.name || release.tag_name,
          apk_name: apkAsset.name,
          apk_url: apkAsset.browser_download_url,
          download_status: autoDownload ? 'pending' : 'pending',
          published_at: release.published_at,
          source: 'poll'
        });

        console.log(`  + ${release.tag_name}: Added to database (ID: ${newRelease.id})`);
        stats.added++;
        releaseResults.push({
          tag: release.tag_name,
          status: 'added'
        });

        // Trigger download if autoDownload is enabled
        if (autoDownload && newRelease.id) {
          // Import dynamically to avoid circular dependency
          const { triggerManualDownload } = await import('./webhookService');
          await triggerManualDownload(newRelease.id);
          console.log(`    → Download triggered for ${release.tag_name}`);
        }

      } catch (error) {
        console.error(`  ✗ ${release.tag_name}: Failed -`, error);
        stats.failed++;
        releaseResults.push({
          tag: release.tag_name,
          status: 'failed',
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const message = `Backfill completed: ${stats.added} added, ${stats.skipped} skipped, ${stats.failed} failed`;
    console.log(message);

    return {
      success: true,
      message,
      stats,
      releases: releaseResults
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Backfill failed:', errorMessage);
    return {
      success: false,
      message: `Backfill failed: ${errorMessage}`
    };
  }
}

/**
 * Get backfill status (check if any releases exist)
 */
export function getBackfillStatus(): {
  hasReleases: boolean;
  releaseCount: number;
  completedCount: number;
} {
  const releases = apkReleaseDb.getAll();
  const completedCount = releases.filter(r => r.download_status === 'completed').length;
  
  return {
    hasReleases: releases.length > 0,
    releaseCount: releases.length,
    completedCount
  };
}

