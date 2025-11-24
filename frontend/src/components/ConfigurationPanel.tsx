import { useState, useEffect } from 'react';
import { ConfigProfile } from '../types';
import { api } from '../services/apiService';

interface ConfigurationPanelProps {
  onSelectProfile: (profile: ConfigProfile, installQuestNav: boolean) => void;
  disabled?: boolean;
  installQuestNav: boolean;
}

export default function ConfigurationPanel({ onSelectProfile, disabled, installQuestNav }: ConfigurationPanelProps) {
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
        <p className="text-error">Error: {error}</p>
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
        <p className="text-error">No configuration available.</p>
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

      <button
        onClick={handleApply}
        disabled={disabled}
        style={{
          marginTop: '1.5rem',
          width: '100%',
          padding: '0.75rem',
          fontSize: '1.1rem',
          fontWeight: 'bold'
        }}
      >
        Apply Configuration
      </button>
    </div>
  );
}

