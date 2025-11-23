/**
 * GitHub API Service
 * Fetches release information from QuestNav GitHub repository
 */

export interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

const QUESTNAV_REPO = 'QuestNav/QuestNav';
const GITHUB_API_BASE = 'https://api.github.com';

export const githubService = {
  /**
   * Fetch the latest QuestNav release
   */
  async getLatestRelease(): Promise<GitHubRelease | null> {
    try {
      const response = await fetch(`${GITHUB_API_BASE}/repos/${QUESTNAV_REPO}/releases/latest`);
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch latest QuestNav release:', error);
      return null;
    }
  },

  /**
   * Get APK download URL from release assets
   * Returns the first .apk file found in release assets
   * Also checks backend for cached version
   */
  async getLatestApkUrl(): Promise<{ url: string; name: string; version: string; hash?: string } | null> {
    try {
      const release = await this.getLatestRelease();
      if (!release) return null;

      // Find APK file in assets
      const apkAsset = release.assets.find(asset => asset.name.endsWith('.apk'));
      if (!apkAsset) {
        console.error('No APK file found in latest QuestNav release');
        return null;
      }

      return {
        url: apkAsset.browser_download_url,
        name: apkAsset.name,
        version: release.tag_name
      };
    } catch (error) {
      console.error('Failed to get APK URL:', error);
      return null;
    }
  },

  /**
   * Fetch all releases (for admin to choose specific version)
   */
  async getAllReleases(): Promise<GitHubRelease[]> {
    try {
      const response = await fetch(`${GITHUB_API_BASE}/repos/${QUESTNAV_REPO}/releases?per_page=10`);
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch QuestNav releases:', error);
      return [];
    }
  }
};

