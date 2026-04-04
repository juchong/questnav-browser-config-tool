/**
 * Input Sanitization Utilities
 * Provides safe sanitization and validation functions
 */

/**
 * Sanitize string input to prevent injection attacks
 * Removes control characters and limits length
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove control characters (except newlines and tabs for error messages)
  let sanitized = input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize device serial - alphanumeric, dashes, underscores only
 */
export function sanitizeDeviceSerial(serial: string): string {
  if (typeof serial !== 'string') {
    return '';
  }
  
  // Allow only alphanumeric, dashes, underscores, and colons (for MAC addresses)
  const sanitized = serial.replace(/[^a-zA-Z0-9\-_:]/g, '');
  
  // Limit length
  return sanitized.substring(0, 100);
}

/**
 * Sanitize device name - printable characters only
 */
export function sanitizeDeviceName(name: string): string {
  if (typeof name !== 'string') {
    return '';
  }
  
  // Remove control characters and limit to printable ASCII + common Unicode
  let sanitized = name.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  
  // Trim and limit length
  sanitized = sanitized.trim();
  return sanitized.substring(0, 200);
}

/**
 * Validate and sanitize JSON size
 */
export function validateJsonSize(obj: any, maxSizeBytes: number = 100000): boolean {
  try {
    const jsonString = JSON.stringify(obj);
    const sizeBytes = Buffer.byteLength(jsonString, 'utf8');
    return sizeBytes <= maxSizeBytes;
  } catch {
    return false;
  }
}

/**
 * Validate browser fingerprint format
 */
export function sanitizeBrowserFingerprint(fingerprint: string): string {
  if (typeof fingerprint !== 'string') {
    return '';
  }
  
  // Fingerprints should be hex strings
  const sanitized = fingerprint.replace(/[^a-fA-F0-9]/g, '');
  
  // Limit length (SHA-256 is 64 chars, allow up to 128)
  return sanitized.substring(0, 128);
}

/**
 * Validate integer within range
 */
export function validateInteger(value: any, min: number, max: number): number | null {
  const parsed = parseInt(value);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

/**
 * Sanitize error message for logging
 * Removes potentially sensitive information
 */
export function sanitizeErrorMessage(error: string): string {
  if (typeof error !== 'string') {
    return 'Unknown error';
  }
  
  // Remove potential file paths
  let sanitized = error.replace(/[A-Za-z]:[\\\/][^\s]*/g, '[PATH]');
  sanitized = sanitized.replace(/\/[^\s]*\//g, '[PATH]/');
  
  // Remove potential tokens/secrets (long hex strings)
  sanitized = sanitized.replace(/[a-fA-F0-9]{32,}/g, '[REDACTED]');
  
  // Limit length
  return sanitizeString(sanitized, 2000);
}

/**
 * Return a safe error message for API responses.
 * In production, returns a generic string to avoid leaking internal details.
 */
export function safeErrorMessage(error: unknown): string {
  if (process.env.NODE_ENV === 'development') {
    return error instanceof Error ? error.message : 'Unknown error';
  }
  return 'Internal server error';
}

