import type { Adb } from '@yume-chan/adb';
import type { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb';

let adbManager: AdbDaemonWebUsbDeviceManager | null = null;
let adbDevice: Adb | null = null;

export interface AdbConnectionResult {
  success: boolean;
  device?: {
    name: string;
    serial: string;
  };
  error?: string;
}

export interface AdbCommandResult {
  success: boolean;
  output?: string;
  error?: string;
}

// Initialize ADB manager (lazy loading to avoid issues with SSR)
async function initializeAdbManager() {
  if (!adbManager) {
    // Dynamic import to handle browser-only code
    const { AdbDaemonWebUsbDeviceManager } = await import('@yume-chan/adb-daemon-webusb');
    adbManager = new AdbDaemonWebUsbDeviceManager();
  }
  return adbManager;
}

export const adbService = {
  // Check if WebUSB is supported
  isSupported(): boolean {
    return 'usb' in navigator;
  },

  // Connect to device
  async connect(): Promise<AdbConnectionResult> {
    try {
      if (!this.isSupported()) {
        return {
          success: false,
          error: 'WebUSB is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.'
        };
      }

      const manager = await initializeAdbManager();
      
      // Request device from user
      const device = await manager.requestDevice();
      
      if (!device) {
        return {
          success: false,
          error: 'No device selected'
        };
      }

      // Import ADB modules dynamically
      const { Adb } = await import('@yume-chan/adb');
      const { AdbDaemonTransport } = await import('@yume-chan/adb');
      const { consumeStream } = await import('@yume-chan/stream-extra');

      // Connect to device
      const connection = await device.connect();
      
      // Create ADB instance
      const transport = await AdbDaemonTransport.authenticate({
        serial: device.serial,
        connection,
        credentialsProvider: {
          name: 'Quest Config Tool',
          privateKey: undefined // Will use default key generation
        }
      });

      adbDevice = new Adb(transport);

      return {
        success: true,
        device: {
          name: device.name,
          serial: device.serial
        }
      };
    } catch (error) {
      console.error('Connection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to device'
      };
    }
  },

  // Disconnect from device
  async disconnect(): Promise<void> {
    if (adbDevice) {
      try {
        await adbDevice.close();
      } catch (error) {
        console.error('Disconnect error:', error);
      }
      adbDevice = null;
    }
  },

  // Check if connected
  isConnected(): boolean {
    return adbDevice !== null;
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
      const { consumeStream } = await import('@yume-chan/stream-extra');
      
      const output = await adbDevice.subprocess.spawn(`shell ${command}`);
      const stdout = await consumeStream(output.stdout);
      
      const outputText = new TextDecoder().decode(stdout);
      
      return {
        success: true,
        output: outputText
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
      
      // Add small delay between commands
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    if (onProgress) {
      onProgress(commands.length, commands.length, '');
    }
    
    return results;
  }
};

