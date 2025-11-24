import { ConnectionState } from '../types';

interface ConnectionStatusProps {
  state: ConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
  disabled?: boolean;
  isConnecting?: boolean;
  onCancelConnection?: () => void;
}

export default function ConnectionStatus({ state, onConnect, onDisconnect, disabled, isConnecting, onCancelConnection }: ConnectionStatusProps) {
  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <h2>Connection Status</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
        <div className={`status-dot ${state.connected ? 'connected' : 'disconnected'}`} />
        <span style={{ flex: 1 }}>
          {state.connected ? (
            `Connected to ${state.device?.name || 'Quest Device'}`
          ) : (
            'Not Connected'
          )}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {state.connected ? (
            <button onClick={onDisconnect} disabled={disabled}>
              Disconnect
            </button>
          ) : isConnecting ? (
            <button onClick={onCancelConnection} style={{ backgroundColor: '#ef4444', color: 'white' }}>
              Cancel
            </button>
          ) : (
            <button onClick={onConnect} disabled={disabled}>
              Connect Quest
            </button>
          )}
        </div>
      </div>
      {state.device && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', opacity: 0.7 }}>
          Serial: {state.device.serial.toUpperCase()}
        </div>
      )}
    </div>
  );
}

