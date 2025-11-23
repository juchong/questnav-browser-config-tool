import { useState, useEffect } from 'react';
import { ConfigProfile } from '../types';
import { api } from '../services/apiService';

interface ConfigurationPanelProps {
  onSelectProfile: (profile: ConfigProfile) => void;
  disabled?: boolean;
}

export default function ConfigurationPanel({ onSelectProfile, disabled }: ConfigurationPanelProps) {
  const [profiles, setProfiles] = useState<ConfigProfile[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProfiles();
      setProfiles(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id!);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    const profile = profiles.find(p => p.id === selectedId);
    if (profile) {
      onSelectProfile(profile);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <h2>Configuration Profile</h2>
        <p>Loading profiles...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>Configuration Profile</h2>
        <p style={{ color: '#ef4444' }}>Error: {error}</p>
        <button onClick={loadProfiles} style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    );
  }

  const selectedProfile = profiles.find(p => p.id === selectedId);

  return (
    <div className="card">
      <h2>Configuration Profile</h2>
      
      <div style={{ marginTop: '1rem' }}>
        <label htmlFor="profile-select" style={{ display: 'block', marginBottom: '0.5rem' }}>
          Select Configuration:
        </label>
        <select
          id="profile-select"
          value={selectedId || ''}
          onChange={(e) => setSelectedId(Number(e.target.value))}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '0.5rem',
            fontSize: '1rem',
            borderRadius: '4px',
            border: '1px solid #444',
            backgroundColor: '#1a1a1a',
            color: 'inherit'
          }}
        >
          {profiles.map(profile => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </div>

      {selectedProfile && (
        <div style={{ marginTop: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
            {selectedProfile.name}
          </h3>
          <p style={{ opacity: 0.8, marginBottom: '1rem' }}>
            {selectedProfile.description}
          </p>
          
          <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
            Commands ({selectedProfile.commands.length}):
          </h4>
          <ul style={{ listStyle: 'none', fontSize: '0.875rem', opacity: 0.9 }}>
            {selectedProfile.commands.map((cmd, idx) => (
              <li key={idx} style={{ marginBottom: '0.5rem', paddingLeft: '1rem' }}>
                • {cmd.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={handleApply}
        disabled={disabled || !selectedId}
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

