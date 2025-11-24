import { BrowserInfo } from '../types';

/**
 * Parse user agent to extract browser name, version, and engine
 */
function parseUserAgent(userAgent: string): { name: string; version: string; engine: string } {
  const ua = userAgent.toLowerCase();
  
  // Detect browser name and version
  let browserName = 'Unknown';
  let browserVersion = 'Unknown';
  let browserEngine = 'Unknown';

  // Chrome
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browserName = 'Chrome';
    const match = ua.match(/chrome\/([\d.]+)/);
    browserVersion = match ? match[1] : 'Unknown';
    browserEngine = 'Blink';
  }
  // Edge
  else if (ua.includes('edg')) {
    browserName = 'Edge';
    const match = ua.match(/edg\/([\d.]+)/);
    browserVersion = match ? match[1] : 'Unknown';
    browserEngine = 'Blink';
  }
  // Firefox
  else if (ua.includes('firefox')) {
    browserName = 'Firefox';
    const match = ua.match(/firefox\/([\d.]+)/);
    browserVersion = match ? match[1] : 'Unknown';
    browserEngine = 'Gecko';
  }
  // Safari
  else if (ua.includes('safari') && !ua.includes('chrome')) {
    browserName = 'Safari';
    const match = ua.match(/version\/([\d.]+)/);
    browserVersion = match ? match[1] : 'Unknown';
    browserEngine = 'WebKit';
  }
  // Opera
  else if (ua.includes('opr') || ua.includes('opera')) {
    browserName = 'Opera';
    const match = ua.match(/(?:opr|opera)\/([\d.]+)/);
    browserVersion = match ? match[1] : 'Unknown';
    browserEngine = 'Blink';
  }
  // Brave (harder to detect, often shows as Chrome)
  else if ((navigator as any).brave && typeof (navigator as any).brave.isBrave === 'function') {
    browserName = 'Brave';
    const match = ua.match(/chrome\/([\d.]+)/);
    browserVersion = match ? match[1] : 'Unknown';
    browserEngine = 'Blink';
  }

  return { name: browserName, version: browserVersion, engine: browserEngine };
}

/**
 * Parse platform to extract OS name and version
 */
function parseOS(userAgent: string): { name: string; version: string } {
  const ua = userAgent.toLowerCase();
  
  let osName = 'Unknown';
  let osVersion = 'Unknown';

  // Windows
  if (ua.includes('win')) {
    osName = 'Windows';
    if (ua.includes('windows nt 10.0')) osVersion = '10/11';
    else if (ua.includes('windows nt 6.3')) osVersion = '8.1';
    else if (ua.includes('windows nt 6.2')) osVersion = '8';
    else if (ua.includes('windows nt 6.1')) osVersion = '7';
  }
  // macOS
  else if (ua.includes('mac')) {
    osName = 'macOS';
    const match = ua.match(/mac os x ([\d._]+)/);
    if (match) {
      osVersion = match[1].replace(/_/g, '.');
    }
  }
  // Linux
  else if (ua.includes('linux')) {
    osName = 'Linux';
    if (ua.includes('android')) {
      osName = 'Android';
      const match = ua.match(/android ([\d.]+)/);
      osVersion = match ? match[1] : 'Unknown';
    } else if (ua.includes('ubuntu')) {
      osVersion = 'Ubuntu';
    } else if (ua.includes('fedora')) {
      osVersion = 'Fedora';
    }
  }
  // iOS
  else if (ua.includes('iphone') || ua.includes('ipad')) {
    osName = ua.includes('ipad') ? 'iPadOS' : 'iOS';
    const match = ua.match(/os ([\d_]+)/);
    if (match) {
      osVersion = match[1].replace(/_/g, '.');
    }
  }
  // Chrome OS
  else if (ua.includes('cros')) {
    osName = 'Chrome OS';
  }

  return { name: osName, version: osVersion };
}

/**
 * Generate a simple browser fingerprint based on various characteristics
 */
function generateFingerprint(): string {
  const components: string[] = [];

  // Navigator properties
  components.push(navigator.userAgent);
  components.push(navigator.language);
  components.push(String(navigator.hardwareConcurrency || 0));
  components.push(String(navigator.maxTouchPoints || 0));
  components.push(navigator.platform);
  
  // Screen properties
  components.push(`${screen.width}x${screen.height}`);
  components.push(`${screen.colorDepth}`);
  components.push(String(screen.pixelDepth));
  
  // Timezone
  components.push(String(new Date().getTimezoneOffset()));
  
  // WebGL (if available)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && gl instanceof WebGLRenderingContext) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
      }
    }
  } catch (e) {
    // WebGL not available
  }

  // Simple hash function
  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36).toUpperCase();
}

/**
 * Collect comprehensive browser information
 */
export function collectBrowserInfo(): BrowserInfo {
  const userAgent = navigator.userAgent;
  const { name: browserName, version: browserVersion, engine: browserEngine } = parseUserAgent(userAgent);
  const { name: osName, version: osVersion } = parseOS(userAgent);
  
  return {
    browser_name: browserName,
    browser_version: browserVersion,
    browser_engine: browserEngine,
    os_name: osName,
    os_version: osVersion,
    platform: navigator.platform,
    screen_resolution: `${screen.width}x${screen.height}`,
    viewport_size: `${window.innerWidth}x${window.innerHeight}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    webusb_supported: typeof navigator !== 'undefined' && 'usb' in navigator,
    browser_fingerprint: generateFingerprint()
  };
}

