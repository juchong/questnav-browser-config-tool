import React from 'react';

interface ErrorHelpProps {
  error: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

interface ErrorHelpContent {
  title: string;
  icon: string;
  description: string;
  steps: string[];
  technical?: string;
  type?: 'error' | 'warning';
}

export default function ErrorHelp({ error, onRetry, onDismiss }: ErrorHelpProps) {
  const errorLower = error.toLowerCase();
  
  // Determine error type and provide specific help
  const getHelpContent = (): ErrorHelpContent => {
    // Incompatible device selected (warning, not critical error)
    if (errorLower.includes('[wrong_device]')) {
      const deviceMatch = error.match(/Device: "(.*?)"/);
      const deviceName = deviceMatch ? deviceMatch[1] : 'Unknown';
      return {
        title: 'Incompatible Device Selected',
        icon: '🔍',
        description: `Incompatible device selected: "${deviceName}"`,
        steps: [
          'This tool is designed for Meta Quest headsets only.',
          'Disconnect other Android devices',
          'Connect your Quest headset via USB',
          'Click "Connect Quest" and select the Quest device',
          'Look for devices named "Quest 2", "Quest 3", or "Quest 3S"'
        ],
        technical: `Selected device "${deviceName}" is not recognized as a Quest headset.`,
        type: 'warning'
      };
    }
    // WebUSB not supported
    else if (errorLower.includes('[webusb_not_supported]')) {
      return {
        title: 'WebUSB Not Supported',
        icon: '🌐',
        description: 'Your browser does not support WebUSB, which is required for this tool.',
        steps: [
          'Use Chrome, Edge, or another Chromium-based browser',
          'Update your browser to the latest version',
          'Ensure you\'re not using private/incognito mode',
          'Check that hardware acceleration is enabled in browser settings'
        ],
        technical: 'navigator.usb API is not available in this browser.'
      };
    }
    // Connection cancelled
    else if (errorLower.includes('[connection_cancelled]')) {
      return {
        title: 'Connection Cancelled',
        icon: '❌',
        description: 'Connection was cancelled.',
        steps: [
          'Click "Connect Quest" to try again',
          'Select your Quest device from the browser popup',
          'Make sure your Quest is connected and powered on'
        ],
        technical: 'User cancelled the connection attempt or device selection.'
      };
    }
    // No device selected
    else if (errorLower.includes('[no_device_selected]')) {
      return {
        title: 'No Device Selected',
        icon: '❌',
        description: 'You didn\'t select a device from the browser popup.',
        steps: [
          'Click "Connect Quest" again',
          'When the browser shows the device picker, select your Quest',
          'Click "Connect" in the browser popup',
          'Make sure your Quest is connected via USB and powered on'
        ],
        technical: 'User cancelled the WebUSB device selection dialog or no devices were available.'
      };
    }
    // Device not found
    else if (errorLower.includes('[device_not_found]')) {
      return {
        title: 'Device Not Found',
        icon: '🔌',
        description: 'No Quest device was detected.',
        steps: [
          'Make sure Quest is connected via USB cable',
          'Check that the USB cable is working (try a different cable or port)',
          'Ensure Quest is powered on and unlocked',
          'Enable USB debugging in Developer Settings (Settings > System > Developer)',
          'Try unplugging and replugging the USB cable',
          'Avoid USB hubs - connect directly to your computer'
        ],
        technical: 'No ADB-compatible device found on the USB bus.'
      };
    }
    // Access denied / permission issues
    else if (errorLower.includes('[access_denied]')) {
      return {
        title: 'Access Denied',
        icon: '🚫',
        description: 'USB debugging permission was denied.',
        steps: [
          'Make sure your Quest is in Developer Mode',
          'Enable USB debugging in Quest Developer Settings',
          'Put on your Quest and look for the "Allow USB debugging?" dialog',
          'Check "Always allow from this computer"',
          'Tap "Allow" or "OK"',
          'Click "Retry Connection" below'
        ],
        technical: 'USB debugging authorization was not granted on the device or browser security blocked access.'
      };
    }
    // Authentication failed / unauthorized
    else if (errorLower.includes('[auth_failed]')) {
      return {
        title: 'Authentication Failed',
        icon: '🔐',
        description: 'The Quest denied the connection.',
        steps: [
          'Put on your Quest headset',
          'Look for the "Allow USB debugging?" dialog',
          'Select "Always allow from this computer"',
          'If the dialog doesn\'t appear, restart your Quest',
          'Try connecting again'
        ],
        technical: 'ADB RSA key authorization failed, was denied, or timed out.'
      };
    }
    // Device busy / in use by another program
    else if (errorLower.includes('[device_busy]') || errorLower.includes('claim') || errorLower.includes('interface') || errorLower.includes('sidequest') || errorLower.includes('adb.exe') || errorLower.includes('developer hub')) {
      return {
        title: 'Device In Use',
        icon: '🔒',
        description: 'Another program is currently communicating with your Quest device.',
        steps: [
          'Click "Disconnect" if you haven\'t already, then wait 2-3 seconds',
          'Try refreshing the page (F5) to clear browser state',
          'Close SideQuest or Meta Quest Developer Hub if it\'s running',
          'On Windows: Open Task Manager and end any "adb.exe" processes',
          'Unplug your Quest, wait 3 seconds, then plug it back in',
          'Reboot your Quest headset',
          'Click "Retry Connection" below'
        ],
        technical: 'USB interface 0 is claimed by another process or the browser has a stale USB connection. Only one program can access ADB at a time.'
      };
    }
    // Connection timeout
    else if (errorLower.includes('[timeout]')) {
      return {
        title: 'Connection Timeout',
        icon: '⏱️',
        description: 'Connection attempt timed out.',
        steps: [
          'Make sure Quest is unlocked (not in sleep mode)',
          'Check USB debugging is enabled in Developer Settings',
          'Put on your Quest and check for permission dialogs',
          'Try unplugging and replugging the USB cable',
          'Try a different USB port (avoid hubs)',
          'Restart your Quest if the problem persists'
        ],
        technical: error.includes('3 minutes') 
          ? 'Authentication timeout - no response from Quest after 3 minutes.' 
          : 'Connection attempt exceeded timeout limit.'
      };
    }
    // Network error (device disconnected)
    else if (errorLower.includes('[network_error]')) {
      return {
        title: 'Device Disconnected',
        icon: '🔌',
        description: 'Device disconnected during connection.',
        steps: [
          'Check USB cable is firmly connected',
          'Try a different USB cable or port',
          'Make sure Quest has enough battery',
          'Avoid USB hubs - connect directly to computer',
          'Check that USB debugging stays enabled',
          'Try a higher quality USB cable if problem persists'
        ],
        technical: 'NetworkError: Device disconnected or USB connection lost during operation.'
      };
    }
    // Generic/unknown error
    else {
      return {
        title: 'Connection Error',
        icon: '⚠️',
        description: 'An unexpected error occurred.',
        steps: [
          'Try refreshing the page',
          'Unplug and replug your Quest',
          'Ensure Quest is unlocked and USB debugging is enabled',
          'Try a different USB cable or port',
          'Restart your browser',
          'Restart your Quest',
          'Check the browser console (F12) for more details'
        ],
        technical: error
      };
    }
  };

  const help = getHelpContent();
  const [showTechnical, setShowTechnical] = React.useState(false);

  // Determine styling based on error type
  const isWarning = help.type === 'warning';

  return (
    <div className={`card ${isWarning ? 'bg-warning-subtle' : 'bg-error-subtle'}`} style={{ 
      borderLeft: `4px solid var(${isWarning ? '--color-amber' : '--text-error'})`,
      marginTop: '1rem' 
    }}>
      <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
        <div style={{ fontSize: '2rem' }}>{help.icon}</div>
        <div style={{ flex: 1 }}>
          <h3 className={isWarning ? 'text-warning' : 'text-error'} style={{ marginBottom: '0.5rem' }}>
            {help.title}
          </h3>
          <p style={{ marginBottom: '1rem', opacity: 0.9 }}>
            {help.description}
          </p>
          
          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.8 }}>
            Steps to fix:
          </h4>
          <ol style={{ 
            paddingLeft: '1.5rem', 
            marginBottom: '1rem',
            lineHeight: 1.8 
          }}>
            {help.steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {onRetry && (
              <button 
                onClick={onRetry}
                style={{ 
                  padding: '0.5rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                Retry Connection
              </button>
            )}
            {onDismiss && (
              <button 
                onClick={onDismiss}
                className="secondary"
                style={{ padding: '0.5rem 1rem' }}
              >
                Dismiss
              </button>
            )}
            {help.technical && (
              <button 
                onClick={() => setShowTechnical(!showTechnical)}
                className="secondary"
                style={{ 
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  opacity: 0.8
                }}
              >
                {showTechnical ? '▼' : '▶'} Technical Details
              </button>
            )}
          </div>

          {showTechnical && help.technical && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.75rem',
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              wordBreak: 'break-word'
            }}>
              {help.technical}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
