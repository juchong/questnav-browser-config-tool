interface AuthenticationStatusProps {
  stage: 'selecting' | 'connecting' | 'authenticating';
  message: string;
  timeRemaining?: number;
  onCancel?: () => void;
}

export default function AuthenticationStatus({ stage, message, timeRemaining, onCancel }: AuthenticationStatusProps) {
  // Determine styling based on stage
  const getStageInfo = () => {
    switch (stage) {
      case 'selecting':
        return {
          icon: '🖱️',
          title: 'Select Device',
          backgroundColor: '#3b82f620',
          borderColor: '#3b82f6',
          titleColor: '#3b82f6'
        };
      case 'connecting':
        return {
          icon: '🔌',
          title: 'Connecting',
          backgroundColor: '#3b82f620',
          borderColor: '#3b82f6',
          titleColor: '#3b82f6'
        };
      case 'authenticating':
        return {
          icon: '📱',
          title: 'Authenticating',
          backgroundColor: '#f59e0b20',
          borderColor: '#f59e0b',
          titleColor: '#f59e0b'
        };
    }
  };

  const info = getStageInfo();

  // Import the USB debugging dialog image
  // Note: Image will be loaded at runtime if it exists in src/assets/
  let usbDebugImage: string | null = null;
  if (stage === 'authenticating') {
    try {
      /* @vite-ignore */
      usbDebugImage = new URL('../assets/quest-usb-debug-dialog.png', import.meta.url).href;
    } catch (e) {
      // Image not available, will be hidden
      usbDebugImage = null;
    }
  }

  return (
    <div className="card" style={{ 
      backgroundColor: info.backgroundColor, 
      borderLeft: `4px solid ${info.borderColor}`,
      marginTop: '1rem',
      marginBottom: '1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
        <div style={{ fontSize: '2rem' }}>{info.icon}</div>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: info.titleColor, marginBottom: '0.5rem', fontSize: '1.125rem' }}>
            {info.title}
          </h3>
          <p style={{ marginBottom: timeRemaining !== undefined ? '0.75rem' : '1rem', opacity: 0.9, lineHeight: 1.6 }}>
            {message}
          </p>
          
          {timeRemaining !== undefined && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              backgroundColor: '#00000020',
              borderRadius: '6px',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '1.5rem' }}>⏱️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                  Time remaining
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  color: info.titleColor
                }}>
                  {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                </div>
              </div>
            </div>
          )}

          {stage === 'authenticating' && usbDebugImage && (
            <div style={{
              marginBottom: '1rem',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '2px solid #00000020',
              backgroundColor: '#00000010',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <img 
                src={usbDebugImage} 
                alt="Quest USB debugging permission dialog - Shows the 'Allow USB debugging?' prompt with RSA key fingerprint and 'Always allow' checkbox"
                className="auth-dialog-image"
                onError={(e) => {
                  // Hide image container if it fails to load
                  const parent = e.currentTarget.parentElement;
                  if (parent) parent.style.display = 'none';
                }}
              />
            </div>
          )}

          {stage === 'authenticating' && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#3b82f610',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              lineHeight: 1.6
            }}>
              <strong>💡 Tip:</strong> Make sure to select <strong>"Always allow from this computer"</strong> to avoid this prompt in the future.
            </div>
          )}

          {onCancel && (
            <button 
              onClick={onCancel}
              style={{ 
                backgroundColor: '#ef4444', 
                color: 'white',
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              ✕ Cancel Connection
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

