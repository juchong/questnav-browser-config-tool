import { ConnectionState } from '../types';

interface ConnectionStatusProps {
  state: ConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
  disabled?: boolean;
}

export default function ConnectionStatus({ state, onConnect, onDisconnect, disabled }: ConnectionStatusProps) {
  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <h2>Connection Status</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: state.connected ? '#4ade80' : '#ef4444'
          }}
        />
        <span style={{ flex: 1 }}>
          {state.connected
            ? `Connected to ${state.device?.name || 'Quest Device'}`
            : 'Not Connected'}
        </span>
        {state.connected ? (
          <button onClick={onDisconnect} disabled={disabled}>
            Disconnect
          </button>
        ) : (
          <button onClick={onConnect} disabled={disabled}>
            Connect Quest
          </button>
        )}
      </div>
      {state.device && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', opacity: 0.7 }}>
          Serial: {state.device.serial}
        </div>
      )}
    </div>
  );
}

