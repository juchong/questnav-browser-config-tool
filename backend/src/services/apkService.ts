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

// APK storage directory
const APK_DIR = process.env.APK_STORAGE_DIR || './data/apks';

// Maximum APK file size (500MB default, configurable via env)
const MAX_APK_SIZE = parseInt(process.env.MAX_APK_SIZE_BYTES || '524288000'); // 500MB in bytes

// Ensure APK directory exists
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
 * Download APK from URL and store it locally
 * Returns SHA256 hash of the downloaded file
 */
export async function downloadAndCacheApk(apkUrl: string, apkName: string): Promise<ApkDownloadResult> {
  try {
    console.log(`Downloading APK from: ${apkUrl}`);
    
    // Download the APK
    const buffer = await downloadFile(apkUrl);
    
    // Compute SHA256 hash
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    
    // Store with hash as filename (prevents duplicates)
    const fileName = `${hash}.apk`;
    const filePath = path.join(APK_DIR, fileName);
    
    // Check if already exists
    if (fs.existsSync(filePath)) {
      console.log(`APK already cached: ${hash}`);
      return {
        success: true,
        hash,
        filePath,
        size: buffer.length
      };
    }
    
    // Write to disk
    fs.writeFileSync(filePath, buffer);
    console.log(`APK cached successfully: ${hash} (${buffer.length} bytes)`);
    
    // Also store metadata for reference
    const metadataPath = path.join(APK_DIR, `${hash}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify({
      hash,
      originalUrl: apkUrl,
      name: apkName,
      size: buffer.length,
      downloadedAt: new Date().toISOString()
    }, null, 2));
    
    return {
      success: true,
      hash,
      filePath,
      size: buffer.length
    };
  } catch (error) {
    console.error('APK download failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Download file from URL and return as Buffer
 * Enforces size limits to prevent abuse
 */
function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const chunks: Buffer[] = [];
    let totalSize = 0;
    
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'QuestNav-Config-Tool/1.0'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect without location header'));
          return;
        }
        
        // Resolve relative redirects
        const absoluteUrl = new URL(redirectUrl, url).toString();
        downloadFile(absoluteUrl).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      // Check Content-Length header if available
      const contentLength = response.headers['content-length'];
      if (contentLength && parseInt(contentLength) > MAX_APK_SIZE) {
        reject(new Error(`APK file too large: ${contentLength} bytes (max: ${MAX_APK_SIZE} bytes)`));
        request.destroy();
        return;
      }
      
      response.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        
        // Check size limit during download
        if (totalSize > MAX_APK_SIZE) {
          reject(new Error(`APK download exceeded size limit: ${MAX_APK_SIZE} bytes`));
          request.destroy();
          return;
        }
        
        chunks.push(chunk);
      });
      
      response.on('end', () => {
        console.log(`Downloaded ${totalSize} bytes`);
        resolve(Buffer.concat(chunks));
      });
      
      response.on('error', (error) => {
        reject(error);
      });
    });
    
    request.on('error', (error) => {
      reject(error);
    });
    
    // Increased timeout for large files
    request.setTimeout(120000, () => {
      request.destroy();
      reject(new Error('Download timeout (120s)'));
    });
  });
}

/**
 * Get APK file path from hash
 */
export function getApkPath(hash: string): string | null {
  const filePath = path.resolve(APK_DIR, `${hash}.apk`);
  return fs.existsSync(filePath) ? filePath : null;
}

/**
 * Verify APK exists and matches hash
 */
export function verifyApk(hash: string): boolean {
  const filePath = getApkPath(hash);
  if (!filePath) return false;
  
  try {
    const buffer = fs.readFileSync(filePath);
    const computedHash = crypto.createHash('sha256').update(buffer).digest('hex');
    return computedHash === hash;
  } catch (error) {
    console.error('APK verification failed:', error);
    return false;
  }
}

/**
 * Delete cached APK (cleanup)
 */
export function deleteApk(hash: string): boolean {
  try {
    const apkPath = path.join(APK_DIR, `${hash}.apk`);
    const metaPath = path.join(APK_DIR, `${hash}.json`);
    
    if (fs.existsSync(apkPath)) {
      fs.unlinkSync(apkPath);
    }
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
    
    return true;
  } catch (error) {
    console.error('APK deletion failed:', error);
    return false;
  }
}

/**
 * List all cached APKs
 */
export function listCachedApks(): Array<{ hash: string; size: number; name?: string }> {
  try {
    const files = fs.readdirSync(APK_DIR);
    const apks: Array<{ hash: string; size: number; name?: string }> = [];
    
    for (const file of files) {
      if (file.endsWith('.apk')) {
        const hash = file.replace('.apk', '');
        const filePath = path.join(APK_DIR, file);
        const stats = fs.statSync(filePath);
        
        // Try to read metadata
        let name: string | undefined;
        const metaPath = path.join(APK_DIR, `${hash}.json`);
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            name = meta.name;
          } catch {}
        }
        
        apks.push({
          hash,
          size: stats.size,
          name
        });
      }
    }
    
    return apks;
  } catch (error) {
    console.error('Failed to list cached APKs:', error);
    return [];
  }
}

