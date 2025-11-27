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
  selectedApkHash?: string;
  onSelectedApkHashChange?: (hash: string) => void;
  onApplyConfiguration?: () => void;
  profile?: ConfigProfile | null;
}

interface CachedRelease {
  release_tag: string;
  apk_name: string;
  apk_hash: string;
  apk_size: number;
  published_at: string;
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
  selectedApkHash,
  onSelectedApkHashChange,
  onApplyConfiguration,
  profile
}: ConnectionStatusProps) {
  const [questNavInfo, setQuestNavInfo] = useState<{ version: string; name: string } | null>(null);
  const [cachedReleases, setCachedReleases] = useState<CachedRelease[]>([]);

  useEffect(() => {
    loadQuestNavInfo();
    loadCachedReleases();
  }, []);

  const loadQuestNavInfo = async () => {
    const info = await githubService.getLatestApkUrl();
    if (info) {
      setQuestNavInfo({ version: info.version, name: info.name });
    }
  };

  const loadCachedReleases = async () => {
    try {
      const response = await fetch('/api/apks/releases/available');
      const data = await response.json();
      if (data.success) {
        // Data is already sorted by published date (newest first)
        setCachedReleases(data.data);
        
        // Auto-select the newest release if none selected
        if (data.data.length > 0 && !selectedApkHash && onSelectedApkHashChange) {
          onSelectedApkHashChange(data.data[0].apk_hash);
        }
      }
    } catch (err) {
      console.error('Failed to load cached releases:', err);
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

      {/* Profile Information - show always when profile is available */}
      {profile && (
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

          {/* QuestNav APK Installation Toggle - show only when connected */}
          {state.connected && onInstallQuestNavChange && onSelectedApkHashChange && (
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
                opacity: disabled ? 0.6 : 1,
                marginBottom: installQuestNav ? '0.75rem' : 0
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
                  <div style={{ fontWeight: 'bold' }}>
                    📦 Install QuestNav APK
                  </div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.8, marginTop: '0.25rem' }}>
                    {installQuestNav ? 'Select version to install' : 'Enable to install the QuestNav app'}
                  </div>
                </div>
              </label>

              {/* Version Selector - show when checkbox is checked */}
              {installQuestNav && (
                <>
                  {cachedReleases.length > 0 ? (
                    <>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                        Select Version:
                      </label>
                      <select
                        value={selectedApkHash || ''}
                        onChange={(e) => onSelectedApkHashChange(e.target.value)}
                        disabled={disabled}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          fontSize: '0.9rem',
                          borderRadius: '4px',
                          border: '1px solid rgba(76, 175, 80, 0.5)',
                          backgroundColor: 'var(--surface-color)',
                          color: 'inherit',
                          cursor: disabled ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {cachedReleases.map((release, index) => (
                          <option key={release.apk_hash} value={release.apk_hash}>
                            {release.release_tag}
                            {index === 0 && ' ⭐ (Newest)'}
                            {' - '}
                            {new Date(release.published_at).toLocaleDateString()}
                          </option>
                        ))}
                      </select>

                      {selectedApkHash && (
                        <div style={{ 
                          marginTop: '0.75rem', 
                          padding: '0.5rem', 
                          backgroundColor: 'rgba(76, 175, 80, 0.1)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          opacity: 0.9
                        }}>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong>Selected:</strong> {cachedReleases.find(r => r.apk_hash === selectedApkHash)?.release_tag}
                            {cachedReleases[0]?.apk_hash === selectedApkHash && ' ⭐'}
                          </div>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', opacity: 0.8 }}>
                            Hash: {selectedApkHash.substring(0, 12)}...
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '4px',
                      fontSize: '0.875rem'
                    }}>
                      <strong>⚠️ No APK versions available</strong>
                      <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>
                        Contact your administrator to download QuestNav releases.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Command Preview - expandable section */}
          <CommandPreview 
            commands={profile.commands}
            includeQuestNav={state.connected && installQuestNav}
            questNavInfo={questNavInfo}
          />

          {/* Apply Configuration Button - show only when connected */}
          {state.connected && onApplyConfiguration && (
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
        </>
      )}
    </div>
  );
}

