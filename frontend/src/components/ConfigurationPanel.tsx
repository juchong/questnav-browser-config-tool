import { useState, useEffect } from 'react';
import { ConfigProfile } from '../types';
import { api } from '../services/apiService';
import { githubService } from '../services/githubService';

interface ConfigurationPanelProps {
  onSelectProfile: (profile: ConfigProfile, installQuestNav: boolean) => void;
  disabled?: boolean;
}

export default function ConfigurationPanel({ onSelectProfile, disabled }: ConfigurationPanelProps) {
  const [profile, setProfile] = useState<ConfigProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installQuestNav, setInstallQuestNav] = useState(true); // Enabled by default
  const [questNavInfo, setQuestNavInfo] = useState<{ version: string; name: string } | null>(null);

  useEffect(() => {
    loadProfile();
    loadQuestNavInfo();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProfiles();
      // API returns array with single active profile
      if (data.length > 0) {
        setProfile(data[0]);
      } else {
        setError('No configuration available. Please contact the administrator.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestNavInfo = async () => {
    const info = await githubService.getLatestApkUrl();
    if (info) {
      setQuestNavInfo({ version: info.version, name: info.name });
    }
  };

  const handleApply = () => {
    if (profile) {
      onSelectProfile(profile, installQuestNav);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <h2>QuestNav Configuration</h2>
        <p>Loading configuration...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>QuestNav Configuration</h2>
        <p style={{ color: '#ef4444' }}>Error: {error}</p>
        <button onClick={loadProfile} style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card">
        <h2>QuestNav Configuration</h2>
        <p style={{ color: '#ef4444' }}>No configuration available.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>QuestNav Configuration</h2>
      
      <div style={{ marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
          {profile.name}
        </h3>
        <p style={{ opacity: 0.8, marginBottom: '1rem' }}>
          {profile.description}
        </p>
        
        {/* Filter hidden commands only for display */}
        {(() => {
          const visibleCommands = profile.commands.filter(cmd => !cmd.is_hidden);
          return (
            <>
              <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                Commands ({visibleCommands.length}):
              </h4>
              <ul style={{ listStyle: 'none', fontSize: '0.875rem', opacity: 0.9 }}>
                {visibleCommands.map((cmd, idx) => (
                  <li key={idx} style={{ marginBottom: '0.5rem', paddingLeft: '1rem' }}>
                    • {cmd.description}
                  </li>
                ))}
              </ul>
            </>
          );
        })()}
      </div>

      {/* QuestNav APK Installation Toggle */}
      <div style={{ 
        marginTop: '1.5rem', 
        padding: '1rem', 
        backgroundColor: '#10b98110', 
        borderRadius: '6px',
        border: '1px solid #10b98133'
      }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem',
          cursor: 'pointer',
          userSelect: 'none'
        }}>
          <input
            type="checkbox"
            checked={installQuestNav}
            onChange={(e) => setInstallQuestNav(e.target.checked)}
            style={{
              width: '1.25rem',
              height: '1.25rem',
              cursor: 'pointer',
              accentColor: '#10b981'
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
              Automatically install the latest QuestNav app for robot tracking and navigation
            </div>
          </div>
        </label>
      </div>

      <button
        onClick={handleApply}
        disabled={disabled}
        style={{
          marginTop: '1.5rem',
          width: '100%',
          padding: '0.75rem',
          fontSize: '1.1rem',
          fontWeight: 'bold',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none'
        }}
      >
        Apply Configuration
      </button>
    </div>
  );
}

