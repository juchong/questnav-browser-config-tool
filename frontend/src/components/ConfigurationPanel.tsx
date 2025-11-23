import { useState, useEffect } from 'react';
import { ConfigProfile } from '../types';
import { api } from '../services/apiService';

interface ConfigurationPanelProps {
  onSelectProfile: (profile: ConfigProfile) => void;
  disabled?: boolean;
}

export default function ConfigurationPanel({ onSelectProfile, disabled }: ConfigurationPanelProps) {
  const [profile, setProfile] = useState<ConfigProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
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

  const handleApply = () => {
    if (profile) {
      onSelectProfile(profile);
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
        
        <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
          Commands ({profile.commands.length}):
        </h4>
        <ul style={{ listStyle: 'none', fontSize: '0.875rem', opacity: 0.9 }}>
          {profile.commands.map((cmd, idx) => (
            <li key={idx} style={{ marginBottom: '0.5rem', paddingLeft: '1rem' }}>
              • {cmd.description}
            </li>
          ))}
        </ul>
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

