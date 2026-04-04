/**
 * APK Download and Caching Service
 * Downloads APKs from URLs, stores them locally, and computes hashes
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const APK_DIR = process.env.APK_STORAGE_DIR || './data/apks';
const MAX_APK_SIZE = parseInt(process.env.MAX_APK_SIZE_BYTES || '524288000');
const MAX_REDIRECTS = 10;
const HASH_PATTERN = /^[a-f0-9]{64}$/i;

if (!fs.existsSync(APK_DIR)) {
  fs.mkdirSync(APK_DIR, { recursive: true });
  console.log(`Created APK storage directory: ${APK_DIR}`);
}

export interface ApkDownloadResult {
  success: boolean;
  hash?: string;
  filePath?: string;
  error?: string;
  size?: number;
}

/**
 * Download APK from URL and store it locally.
 * Streams directly to a temp file to avoid buffering large files in memory.
 */
export async function downloadAndCacheApk(apkUrl: string, apkName: string): Promise<ApkDownloadResult> {
  const tmpPath = path.join(APK_DIR, `_download_${Date.now()}.tmp`);
  try {
    console.log(`Downloading APK from: ${apkUrl}`);

    const { hash, size } = await downloadToFile(apkUrl, tmpPath);
    const fileName = `${hash}.apk`;
    const filePath = path.join(APK_DIR, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(tmpPath);
      console.log(`APK already cached: ${hash}`);
      return { success: true, hash, filePath, size };
    }

    fs.renameSync(tmpPath, filePath);
    console.log(`APK cached successfully: ${hash} (${size} bytes)`);

    const metadataPath = path.join(APK_DIR, `${hash}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify({
      hash,
      originalUrl: apkUrl,
      name: apkName,
      size,
      downloadedAt: new Date().toISOString()
    }, null, 2));

    return { success: true, hash, filePath, size };
  } catch (error) {
    try { fs.unlinkSync(tmpPath); } catch {}
    console.error('APK download failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Stream a URL download directly to a file while computing its SHA256 hash.
 * Enforces size limits and a redirect depth cap.
 */
function downloadToFile(url: string, destPath: string, redirectsRemaining: number = MAX_REDIRECTS): Promise<{ hash: string; size: number }> {
  return new Promise((resolve, reject) => {
    if (redirectsRemaining <= 0) {
      return reject(new Error('Too many redirects'));
    }

    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const request = protocol.get(url, {
      headers: { 'User-Agent': 'QuestNav-Config-Tool/1.0' }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          return reject(new Error('Redirect without location header'));
        }
        const absoluteUrl = new URL(redirectUrl, url).toString();
        downloadToFile(absoluteUrl, destPath, redirectsRemaining - 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
      }

      const contentLength = response.headers['content-length'];
      if (contentLength && parseInt(contentLength) > MAX_APK_SIZE) {
        request.destroy();
        return reject(new Error(`APK file too large: ${contentLength} bytes (max: ${MAX_APK_SIZE} bytes)`));
      }

      const hashStream = crypto.createHash('sha256');
      const fileStream = fs.createWriteStream(destPath);
      let totalSize = 0;

      response.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > MAX_APK_SIZE) {
          request.destroy();
          fileStream.destroy();
          reject(new Error(`APK download exceeded size limit: ${MAX_APK_SIZE} bytes`));
          return;
        }
        hashStream.update(chunk);
      });

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        const hash = hashStream.digest('hex');
        console.log(`Downloaded ${totalSize} bytes`);
        resolve({ hash, size: totalSize });
      });

      fileStream.on('error', (err) => reject(err));
      response.on('error', (err) => reject(err));
    });

    request.on('error', (err) => reject(err));
    request.setTimeout(120000, () => {
      request.destroy();
      reject(new Error('Download timeout (120s)'));
    });
  });
}

function isValidHash(hash: string): boolean {
  return HASH_PATTERN.test(hash);
}

export function getApkPath(hash: string): string | null {
  if (!isValidHash(hash)) return null;
  const filePath = path.resolve(APK_DIR, `${hash}.apk`);
  return fs.existsSync(filePath) ? filePath : null;
}

/**
 * Verify APK exists and matches hash using streaming hash (no full-file buffer).
 */
export function verifyApk(hash: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isValidHash(hash)) return resolve(false);
    const filePath = getApkPath(hash);
    if (!filePath) return resolve(false);

    const hashStream = crypto.createHash('sha256');
    const readStream = fs.createReadStream(filePath);

    readStream.on('data', (chunk) => hashStream.update(chunk));
    readStream.on('end', () => {
      resolve(hashStream.digest('hex') === hash);
    });
    readStream.on('error', () => resolve(false));
  });
}

export function deleteApk(hash: string): boolean {
  if (!isValidHash(hash)) return false;
  try {
    const apkPath = path.join(APK_DIR, `${hash}.apk`);
    const metaPath = path.join(APK_DIR, `${hash}.json`);

    if (fs.existsSync(apkPath)) fs.unlinkSync(apkPath);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    return true;
  } catch (error) {
    console.error('APK deletion failed:', error);
    return false;
  }
}

export function listCachedApks(): Array<{ hash: string; size: number; name?: string }> {
  try {
    const files = fs.readdirSync(APK_DIR);
    const apks: Array<{ hash: string; size: number; name?: string }> = [];

    for (const file of files) {
      if (file.endsWith('.apk')) {
        const hash = file.replace('.apk', '');
        const filePath = path.join(APK_DIR, file);
        const stats = fs.statSync(filePath);

        let name: string | undefined;
        const metaPath = path.join(APK_DIR, `${hash}.json`);
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            name = meta.name;
          } catch {}
        }

        apks.push({ hash, size: stats.size, name });
      }
    }

    return apks;
  } catch (error) {
    console.error('Failed to list cached APKs:', error);
    return [];
  }
}
