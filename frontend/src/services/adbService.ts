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
    if (!adbDevice) {
      return {
        success: false,
        error: 'Not connected to device'
      };
    }

    try {
      // Use the new shell protocol API
      const shellProtocol = adbDevice.subprocess.shellProtocol;
      if (!shellProtocol) {
        // Fallback to older protocol - returns just the output string
        const output = await adbDevice.subprocess.noneProtocol.spawnWaitText(command);
        return {
          success: true,
          output: output || ''
        };
      }

      // Spawn the command and wait for completion
      const result = await shellProtocol.spawnWaitText(command);
      
      return {
        success: result.exitCode === 0,
        output: result.stdout || ''
      };
    } catch (error) {
      console.error('Command execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute command'
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
  }
};

