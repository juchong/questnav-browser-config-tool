import type { Adb } from '@yume-chan/adb';
import type { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';

let adbManager: AdbDaemonWebUsbDeviceManager | null = null;
let adbDevice: Adb | null = null;

// Track active connection attempt
let activeConnectionAbortController: AbortController | null = null;
let activeCountdownInterval: number | null = null;

// Use the official web credential store
const credentialStore = new AdbWebCredentialStore('QuestConfigTool');

// Clean up on page unload/refresh
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    console.log('Page unloading - cleaning up active connections...');
    if (activeCountdownInterval) {
      clearInterval(activeCountdownInterval);
      activeCountdownInterval = null;
    }
    if (activeConnectionAbortController) {
      activeConnectionAbortController.abort();
      activeConnectionAbortController = null;
    }
  });
}

export interface AdbConnectionResult {
  success: boolean;
  device?: {
    name: string;
    serial: string;
  };
  error?: string;
}

export interface AdbConnectionStatus {
  stage: 'selecting' | 'connecting' | 'authenticating' | 'complete' | 'error';
  message: string;
  timeRemaining?: number; // Seconds remaining for authentication
}

export type AdbConnectionStatusCallback = (status: AdbConnectionStatus) => void;

// Authentication timeout in milliseconds (3 minutes)
const AUTH_TIMEOUT_MS = 180000; // 3 minutes

export interface AdbCommandResult {
  success: boolean;
  output?: string;
  error?: string;
  duration_ms?: number;
  timestamp?: string;
}

// Initialize ADB manager
async function getAdbManager() {
  if (!adbManager) {
    const { AdbDaemonWebUsbDeviceManager } = await import('@yume-chan/adb-daemon-webusb');
    // Pass browser's USB interface directly
    adbManager = new AdbDaemonWebUsbDeviceManager(navigator.usb);
  }
  return adbManager;
}

export const adbService = {
  // Check if WebUSB is supported
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  },

  // Cancel active connection attempt
  cancelConnection(): void {
    if (activeConnectionAbortController) {
      console.log('Cancelling connection...');
      activeConnectionAbortController.abort();
      activeConnectionAbortController = null;
    }
    if (activeCountdownInterval) {
      clearInterval(activeCountdownInterval);
      activeCountdownInterval = null;
    }
  },

  // Check if connection is in progress
  isConnecting(): boolean {
    return activeConnectionAbortController !== null;
  },

  // Connect to device
  async connect(statusCallback?: AdbConnectionStatusCallback): Promise<AdbConnectionResult> {
    try {
      if (!this.isSupported()) {
        return {
          success: false,
          error: '[WEBUSB_NOT_SUPPORTED]'
        };
      }

      // Cancel any existing connection attempt
      if (activeConnectionAbortController) {
        console.log('Cancelling previous connection attempt...');
        activeConnectionAbortController.abort();
      }

      // Create new abort controller for this connection attempt
      activeConnectionAbortController = new AbortController();
      const abortSignal = activeConnectionAbortController.signal;

      // Check if already aborted
      if (abortSignal.aborted) {
        return {
          success: false,
          error: '[CONNECTION_CANCELLED]'
        };
      }

      // Get manager instance
      const manager = await getAdbManager();
      
      // Request device - browser will show device picker
      if (statusCallback) statusCallback({ stage: 'selecting', message: 'Please select your Quest from the device picker...' });
      console.log('Requesting device...');
      
      const device = await manager.requestDevice();
      
      if (!device) {
        // User cancelled the picker or no devices available
        activeConnectionAbortController = null;
        return {
          success: false,
          error: '[NO_DEVICE_SELECTED]'
        };
      }

      // Check if cancelled during device selection
      if (abortSignal.aborted) {
        return {
          success: false,
          error: '[CONNECTION_CANCELLED]'
        };
      }

      console.log('Device selected:', {
        name: device.name,
        serial: device.serial
      });

      // Validate that it's a Quest 2 or Quest 3 - STOP if not
      const deviceName = device.name.toLowerCase();
      const isQuest2 = deviceName.includes('quest 2');
      const isQuest3 = deviceName.includes('quest 3');
      
      if (!isQuest2 && !isQuest3) {
        console.warn('Selected device is not Quest 2 or Quest 3:', device.name);
        activeConnectionAbortController = null;
        return {
          success: false,
          error: `[WRONG_DEVICE] Device: "${device.name}"`
        };
      }

      console.log(`Valid Quest device detected: ${device.name}`);

      // Import ADB modules
      const { Adb, AdbDaemonTransport } = await import('@yume-chan/adb');

      // Connect to the device - this handles all USB operations internally
      if (statusCallback) statusCallback({ stage: 'connecting', message: 'Connecting to device...' });
      console.log('Connecting to device...');
      const connection = await device.connect();
      console.log('Connection established');
      
      // Check if cancelled during connection
      if (abortSignal.aborted) {
        return {
          success: false,
          error: '[CONNECTION_CANCELLED]'
        };
      }
      
      // Authenticate with the device (supports Android 14+ delayed ack automatically)
      // This may prompt the user on their Quest headset to allow USB debugging
      if (statusCallback) statusCallback({ 
        stage: 'authenticating', 
        message: 'Check your Quest headset for the USB debugging permission dialog. Select "Always allow from this computer" and tap Allow.',
        timeRemaining: AUTH_TIMEOUT_MS / 1000
      });
      console.log('Authenticating... If this is your first time connecting, check your Quest headset for a permission dialog.');
      
      // Set up countdown timer
      const authStartTime = Date.now();
      activeCountdownInterval = setInterval(() => {
        const elapsed = Date.now() - authStartTime;
        const remaining = Math.max(0, Math.floor((AUTH_TIMEOUT_MS - elapsed) / 1000));
        
        if (statusCallback && remaining > 0) {
          statusCallback({ 
            stage: 'authenticating', 
            message: 'Check your Quest headset for the USB debugging permission dialog. Select "Always allow from this computer" and tap Allow.',
            timeRemaining: remaining
          });
        }
      }, 1000);
      
      try {
        // Create authentication promise with timeout and cancellation
        const authPromise = AdbDaemonTransport.authenticate({
          serial: device.serial,
          connection,
          credentialStore
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('[TIMEOUT] Authentication timeout - no response from Quest after 3 minutes'));
          }, AUTH_TIMEOUT_MS);
        });

        const cancelPromise = new Promise<never>((_, reject) => {
          abortSignal.addEventListener('abort', () => {
            reject(new Error('[CONNECTION_CANCELLED]'));
          });
        });
        
        // Race between authentication, timeout, and cancellation
        const transport = await Promise.race([authPromise, timeoutPromise, cancelPromise]);
        
        if (activeCountdownInterval) {
          clearInterval(activeCountdownInterval);
          activeCountdownInterval = null;
        }
        activeConnectionAbortController = null;
        console.log('Authentication successful');

        // Create ADB instance
        adbDevice = new Adb(transport);

        if (statusCallback) statusCallback({ stage: 'complete', message: 'Connected successfully!' });

        // Get the real device serial number
        console.log('Fetching device serial number...');
        const realSerial = await this.getDeviceSerial();
        const displaySerial = realSerial || device.serial;
        
        console.log('Device serial:', {
          usbSerial: device.serial,
          deviceSerial: realSerial,
          display: displaySerial
        });

        if (import.meta.env.VITE_DEBUG_MODE === 'true') {
          console.log('[DEBUG] Connection successful, adbDevice is now:', adbDevice ? 'set' : 'null');
        }

        return {
          success: true,
          device: {
            name: device.name,
            serial: displaySerial
          }
        };
      } catch (authError) {
        if (activeCountdownInterval) {
          clearInterval(activeCountdownInterval);
          activeCountdownInterval = null;
        }
        activeConnectionAbortController = null;
        throw authError;
      }
    } catch (error) {
      // Check if this was a user-initiated cancellation
      const isCancellation = error instanceof Error && 
        (error.message.toLowerCase().includes('[connection_cancelled]'));
      
      if (!isCancellation) {
        // Only log as error if it's not a user cancellation
        console.error('Connection error:', error);
        console.error('Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      } else {
        console.log('Connection cancelled by user');
      }
      
      // User-friendly error messages with type identifiers
      let errorMessage = '[GENERIC_ERROR] Failed to connect to device';
      
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        const errorName = error.name;
        
        // Connection cancelled by user - return early without error logging
        if (msg.includes('[connection_cancelled]')) {
          return {
            success: false,
            error: '[CONNECTION_CANCELLED]'
          };
        }
        // User cancelled device selection
        else if (msg.includes('no device selected') || msg.includes('user cancelled') || msg.includes('user canceled') || errorName === 'NotFoundError') {
          errorMessage = '[NO_DEVICE_SELECTED]';
        } 
        // Device not found / no devices available
        else if (msg.includes('no device') || msg.includes('device not found') || msg.includes('not connected')) {
          errorMessage = '[DEVICE_NOT_FOUND]';
        }
        // Access denied / permission issues
        else if (msg.includes('access denied') || msg.includes('permission') || errorName === 'SecurityError') {
          errorMessage = '[ACCESS_DENIED]';
        }
        // Authentication failed / unauthorized
        else if (msg.includes('unauthorized') || msg.includes('auth') || msg.includes('[timeout]')) {
          errorMessage = '[AUTH_FAILED]';
        }
        // Device busy (another program using it)
        else if (msg.includes('busy') || msg.includes('claim') || msg.includes('interface')) {
          errorMessage = '[DEVICE_BUSY]';
        }
        // Timeout
        else if (msg.includes('timeout')) {
          errorMessage = '[TIMEOUT]';
        }
        // Network error (device disconnected)
        else if (errorName === 'NetworkError') {
          errorMessage = '[NETWORK_ERROR]';
        }
        // Generic error - preserve original message for technical details
        else {
          errorMessage = `[GENERIC_ERROR] ${error.message}`;
        }
      }
      
      if (statusCallback) statusCallback({ stage: 'error', message: errorMessage });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  },

  // Disconnect from device
  async disconnect(): Promise<void> {
    if (import.meta.env.VITE_DEBUG_MODE === 'true') {
      console.log('[DEBUG] disconnect() called');
      console.log('[DEBUG] adbDevice before disconnect:', adbDevice ? 'connected' : 'null');
    }
    console.log('Disconnecting...');
    
    // Cancel any active connection attempt
    if (activeConnectionAbortController) {
      activeConnectionAbortController.abort();
      activeConnectionAbortController = null;
    }
    
    // Clear any active countdown
    if (activeCountdownInterval) {
      clearInterval(activeCountdownInterval);
      activeCountdownInterval = null;
    }
    
    // Close ADB connection - this handles all cleanup internally
    if (adbDevice) {
      try {
        console.log('Closing ADB device...');
        await adbDevice.close();
        console.log('ADB device closed successfully');
      } catch (error) {
        console.error('Error closing ADB:', error);
      }
      adbDevice = null;
    }
    
    console.log('Disconnect complete');
  },

  // Check if connected
  isConnected(): boolean {
    return adbDevice !== null;
  },

  // Get actual device serial number from device properties
  async getDeviceSerial(): Promise<string | null> {
    if (!adbDevice) {
      return null;
    }

    try {
      const result = await this.executeCommand('getprop ro.serialno');
      if (result.success && result.output) {
        return result.output.trim().toUpperCase();
      }
      return null;
    } catch (error) {
      console.error('Failed to get device serial:', error);
      return null;
    }
  },

  // Execute shell command
  async executeCommand(command: string): Promise<AdbCommandResult> {
    if (import.meta.env.VITE_DEBUG_MODE === 'true') {
      console.log('[DEBUG] executeCommand called with:', command);
      console.log('[DEBUG] adbDevice state:', adbDevice ? 'connected' : 'null');
    }
    
    if (!adbDevice) {
      if (import.meta.env.VITE_DEBUG_MODE === 'true') {
        console.error('[DEBUG] executeCommand failed: adbDevice is null');
      }
      return {
        success: false,
        error: 'Not connected to device'
      };
    }

    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Use the new shell protocol API
      const shellProtocol = adbDevice.subprocess.shellProtocol;
      if (!shellProtocol) {
        // Fallback to older protocol - returns just the output string
        const output = await adbDevice.subprocess.noneProtocol.spawnWaitText(command);
        const duration = Date.now() - startTime;
        
        // Check for pm install failures in output
        const hasPmError = output && (output.includes('Failure') || output.includes('Error'));
        
        return {
          success: !hasPmError,
          output: output || '',
          error: hasPmError ? output : undefined,
          duration_ms: duration,
          timestamp
        };
      }

      // Spawn the command and wait for completion
      const result = await shellProtocol.spawnWaitText(command);
      const duration = Date.now() - startTime;
      
      // Log raw result for debugging
      // if (command.includes('pm install')) {
      //   console.log('Raw shell result:', { 
      //     exitCode: result.exitCode, 
      //     stdout: result.stdout, 
      //     stderr: result.stderr 
      //   });
      // }
      
      // Combine stdout and stderr for complete output
      const output = result.stdout || '';
      const stderr = result.stderr || '';
      const combinedOutput = output + (stderr ? '\n' + stderr : '');
      
      // For pm install commands, check output for failure messages
      // pm install often returns exit code 0 even on failure
      const isPmInstall = command.includes('pm install');
      const hasPmError = isPmInstall && 
        (combinedOutput.includes('Failure') || combinedOutput.includes('Error'));
      
      return {
        success: result.exitCode === 0 && !hasPmError,
        output: combinedOutput,
        error: hasPmError ? combinedOutput : (stderr || undefined),
        duration_ms: duration,
        timestamp
      };
    } catch (error) {
      console.error('Command execution error:', error);
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute command',
        duration_ms: duration,
        timestamp
      };
    }
  },

  // Execute multiple commands in sequence
  async executeCommands(commands: string[], onProgress?: (current: number, total: number, command: string) => void): Promise<AdbCommandResult[]> {
    const results: AdbCommandResult[] = [];
    
    for (let i = 0; i < commands.length; i++) {
      if (onProgress) {
        onProgress(i, commands.length, commands[i]);
      }
      
      const result = await this.executeCommand(commands[i]);
      results.push(result);
      
      // Small delay between commands
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    if (onProgress) {
      onProgress(commands.length, commands.length, '');
    }
    
    return results;
  },

  /**
   * Install APK from backend-cached file
   * Downloads APK from backend (no CORS issues), uploads to device, installs, and cleans up
   */
  async installApk(apkHash: string, apkName: string, onProgress?: (stage: string, progress: number) => void): Promise<AdbCommandResult> {
    if (!adbDevice) {
      return {
        success: false,
        error: 'Not connected to device'
      };
    }

    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    // Use /data/local/tmp/ which has proper SELinux context for package installation
    const tempPath = `/data/local/tmp/${apkName}`;

    try {
      // Stage 1: Download APK from backend (no CORS issues!)
      if (onProgress) onProgress('Downloading APK from server...', 10);
      
      const response = await fetch(`/api/apks/${apkHash}`);
      if (!response.ok) {
        throw new Error(`Failed to download APK: ${response.statusText}`);
      }

      if (onProgress) onProgress('APK downloaded', 30);

      // Stage 2: Upload APK to device using ADB sync
      if (onProgress) onProgress('Uploading to device...', 40);

      const sync = await adbDevice.sync();
      try {
        // Get ReadableStream from response body
        // Tango ADB requires a ReadableStream for file upload
        if (!response.body) {
          throw new Error('Response body is null');
        }
        
        console.log(`[APK DEBUG] Starting upload to ${tempPath}`);
        
        // Write file to device directly from stream
        // Cast to any to avoid ReadableStream type conflicts between DOM and Node types
        await sync.write({
          filename: tempPath,
          file: response.body as any,
        });
        
        console.log('[APK DEBUG] Upload complete');
        if (onProgress) onProgress('Upload complete', 60);
      } catch (uploadError) {
        console.error('Upload failed:', uploadError);
        throw new Error(`Failed to upload APK to device: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
      } finally {
        sync.dispose();
      }

      // Verify file exists on device
      const verifyResult = await this.executeCommand(`ls -lh "${tempPath}"`);
      console.log('[APK DEBUG] File verification:', verifyResult);
      if (!verifyResult.success || !verifyResult.output || verifyResult.output.includes('No such file')) {
        throw new Error('APK was not uploaded successfully to device');
      }

      // Stage 3: Install APK using package manager
      if (onProgress) onProgress('Installing APK...', 70);

      // Use 'cmd package install' which is more reliable for large APKs on newer Android
      // -r: replace existing app, -t: allow test packages, -g: grant all permissions
      console.log(`[APK DEBUG] Executing: cmd package install -r -t -g "${tempPath}"`);
      const installResult = await this.executeCommand(`cmd package install -r -t -g "${tempPath}"`);
      console.log('[APK DEBUG] PM install result:', JSON.stringify(installResult, null, 2));
      
      if (!installResult.success) {
        const errorMsg = installResult.error || installResult.output || 'Unknown installation error';
        console.error('PM install failed. Full result:', installResult);
        throw new Error(`Installation failed: ${errorMsg}`);
      }
      
      console.log('[APK DEBUG] PM install succeeded:', installResult.output);

      if (onProgress) onProgress('Cleaning up...', 90);

      // Stage 4: Clean up temporary file (don't fail if cleanup fails)
      try {
        await this.executeCommand(`rm "${tempPath}"`);
        console.log('[APK DEBUG] Cleanup successful');
      } catch (cleanupError) {
        console.warn('Cleanup failed (non-critical):', cleanupError);
        // Don't fail the installation if cleanup fails
      }

      if (onProgress) onProgress('Installation complete', 100);

      const duration = Date.now() - startTime;
      return {
        success: true,
        output: `Successfully installed ${apkName}`,
        duration_ms: duration,
        timestamp
      };

    } catch (error) {
      console.error('APK installation error:', error);
      
      // Attempt cleanup on error
      try {
        await this.executeCommand(`rm "${tempPath}"`);
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }

      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to install APK',
        duration_ms: duration,
        timestamp
      };
    }
  }
};

