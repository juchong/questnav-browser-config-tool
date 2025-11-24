import { ConnectionState, ConfigProfile } from '../types';
import { useState, useEffect } from 'react';
import { githubService } from '../services/githubService';
import CommandPreview from './CommandPreview';

interface ConnectionStatusProps {
  state: ConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
  disabled?: boolean;
  isConnecting?: boolean;
  onCancelConnection?: () => void;
  installQuestNav?: boolean;
  onInstallQuestNavChange?: (checked: boolean) => void;
  onApplyConfiguration?: () => void;
  profile?: ConfigProfile | null;
}

export default function ConnectionStatus({ 
  state, 
  onConnect, 
  onDisconnect, 
  disabled, 
  isConnecting, 
  onCancelConnection,
  installQuestNav = true,
  onInstallQuestNavChange,
  onApplyConfiguration,
  profile
}: ConnectionStatusProps) {
  const [questNavInfo, setQuestNavInfo] = useState<{ version: string; name: string } | null>(null);

  useEffect(() => {
    loadQuestNavInfo();
  }, []);

  const loadQuestNavInfo = async () => {
    const info = await githubService.getLatestApkUrl();
    if (info) {
      setQuestNavInfo({ version: info.version, name: info.name });
    }
  };

  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <h3>Connection Status</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
        <div 
          className={`status-dot ${state.connected ? 'connected' : 'disconnected'}`}
          style={{
            width: '20px',
            height: '20px',
            flexShrink: 0
          }}
        />
        <span style={{ 
          flex: 1,
          fontWeight: 600,
          fontSize: '1.1rem',
          color: state.connected ? 'var(--color-success)' : '#ef4444'
        }}>
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

      {/* QuestNav APK Installation Toggle - show when connected */}
      {state.connected && onInstallQuestNavChange && profile && (
        <>
          {/* Profile Information */}
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
              {profile.name}
            </h3>
            <p style={{ opacity: 0.8, marginBottom: '1rem', fontSize: '0.95rem' }}>
              {profile.description}
            </p>
          </div>

          <div className="bg-success-subtle" style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            borderRadius: '6px',
            border: '1px solid rgba(76, 175, 80, 0.3)'
          }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              userSelect: 'none',
              opacity: disabled ? 0.6 : 1
            }}>
              <input
                type="checkbox"
                checked={installQuestNav}
                onChange={(e) => onInstallQuestNavChange(e.target.checked)}
                disabled={disabled}
                style={{
                  width: '1.25rem',
                  height: '1.25rem',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  accentColor: 'var(--color-success)'
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                  📦 Install QuestNav APK
                  {questNavInfo && (
                    <span style={{ 
                      marginLeft: '0.5rem', 
                      fontSize: '0.75rem', 
                      fontWeight: 'normal', 
                      opacity: 0.7 
                    }}>
                      ({questNavInfo.version})
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Automatically install the latest released version of the QuestNav app
                </div>
              </div>
            </label>
          </div>

          {/* Apply Configuration Button */}
          {onApplyConfiguration && (
            <button
              onClick={onApplyConfiguration}
              disabled={disabled}
              style={{
                marginTop: '1rem',
                width: '100%',
                padding: '0.75rem',
                fontSize: '1.1rem',
                fontWeight: 'bold'
              }}
            >
              Apply Configuration
            </button>
          )}

          {/* Command Preview - expandable section below button */}
          <CommandPreview 
            commands={profile.commands}
            includeQuestNav={installQuestNav}
            questNavInfo={questNavInfo}
          />
        </>
      )}
    </div>
  );
}

