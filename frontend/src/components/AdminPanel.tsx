import { useState, useEffect } from 'react';
import { ConfigProfile, AdbCommand } from '../types';
import { api } from '../services/apiService';

const CATEGORIES = ['refresh_rate', 'performance', 'display', 'privacy', 'system'] as const;

interface AdminPanelProps {
  onLogout: () => void;
}

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [profiles, setProfiles] = useState<ConfigProfile[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<ConfigProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [profilesData, statsData] = await Promise.all([
        api.getAllProfiles(),
        api.getStats()
      ]);
      setProfiles(profilesData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingProfile({
      name: '',
      description: '',
      commands: []
    });
    setIsCreating(true);
  };

  const handleEdit = (profile: ConfigProfile) => {
    setEditingProfile({ ...profile });
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!editingProfile) return;

    try {
      if (isCreating) {
        await api.createProfile(editingProfile);
      } else if (editingProfile.id) {
        await api.updateProfile(editingProfile.id, editingProfile);
      }
      setEditingProfile(null);
      setIsCreating(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save profile');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this profile?')) return;

    try {
      await api.deleteProfile(id);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete profile');
    }
  };

  const handleSetActive = async (id: number) => {
    try {
      await api.setActiveProfile(id);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to set active profile');
    }
  };

  const addCommand = () => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      commands: [
        ...editingProfile.commands,
        { command: '', description: '', category: 'system' }
      ]
    });
  };

  const updateCommand = (index: number, field: keyof AdbCommand, value: string) => {
    if (!editingProfile) return;
    const newCommands = [...editingProfile.commands];
    newCommands[index] = { ...newCommands[index], [field]: value };
    setEditingProfile({ ...editingProfile, commands: newCommands });
  };

  const removeCommand = (index: number) => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      commands: editingProfile.commands.filter((_, i) => i !== index)
    });
  };

  if (loading) return <div className="card">Loading...</div>;
  if (error) return <div className="card" style={{ color: '#ef4444' }}>Error: {error}</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Admin Panel</h1>
        <button 
          onClick={onLogout}
          style={{
            backgroundColor: '#ef4444',
            color: 'white',
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          Logout
        </button>
      </div>
      
      {/* Statistics */}
      {stats && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h2>Statistics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.total}</div>
              <div style={{ opacity: 0.7 }}>Total Executions</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4ade80' }}>{stats.success}</div>
              <div style={{ opacity: 0.7 }}>Successful</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>{stats.failure}</div>
              <div style={{ opacity: 0.7 }}>Failed</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.successRate.toFixed(1)}%</div>
              <div style={{ opacity: 0.7 }}>Success Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Editor */}
      {editingProfile ? (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h2>{isCreating ? 'Create New Profile' : 'Edit Profile'}</h2>
          
          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Profile Name:</label>
            <input
              type="text"
              value={editingProfile.name}
              onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                borderRadius: '4px',
                border: '1px solid #444',
                backgroundColor: '#1a1a1a',
                color: 'inherit'
              }}
            />
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Description:</label>
            <textarea
              value={editingProfile.description}
              onChange={(e) => setEditingProfile({ ...editingProfile, description: e.target.value })}
              rows={3}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                borderRadius: '4px',
                border: '1px solid #444',
                backgroundColor: '#1a1a1a',
                color: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3>Commands</h3>
              <button onClick={addCommand}>Add Command</button>
            </div>
            
            {editingProfile.commands.map((cmd, idx) => (
              <div key={idx} style={{ border: '1px solid #444', borderRadius: '4px', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong>Command {idx + 1}</strong>
                  <button onClick={() => removeCommand(idx)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
                    Remove
                  </button>
                </div>
                
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Description:</label>
                <input
                  type="text"
                  value={cmd.description}
                  onChange={(e) => updateCommand(idx, 'description', e.target.value)}
                  placeholder="What does this command do?"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.9rem',
                    borderRadius: '4px',
                    border: '1px solid #444',
                    backgroundColor: '#1a1a1a',
                    color: 'inherit',
                    marginBottom: '0.5rem'
                  }}
                />
                
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Command:</label>
                <input
                  type="text"
                  value={cmd.command}
                  onChange={(e) => updateCommand(idx, 'command', e.target.value)}
                  placeholder="e.g., setprop debug.oculus.refreshRate 120"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.9rem',
                    borderRadius: '4px',
                    border: '1px solid #444',
                    backgroundColor: '#1a1a1a',
                    color: 'inherit',
                    fontFamily: 'monospace',
                    marginBottom: '0.5rem'
                  }}
                />
                
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Category:</label>
                <select
                  value={cmd.category}
                  onChange={(e) => updateCommand(idx, 'category', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.9rem',
                    borderRadius: '4px',
                    border: '1px solid #444',
                    backgroundColor: '#1a1a1a',
                    color: 'inherit'
                  }}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button onClick={handleSave} style={{ flex: 1, backgroundColor: '#3b82f6', color: 'white' }}>
              Save Profile
            </button>
            <button onClick={() => { setEditingProfile(null); setIsCreating(false); }} style={{ flex: 1 }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '2rem' }}>
          <button onClick={handleCreateNew} style={{ backgroundColor: '#3b82f6', color: 'white' }}>
            Create New Profile
          </button>
        </div>
      )}

      {/* Profiles List */}
      <div className="card">
        <h2>Existing Profiles</h2>
        {profiles.length === 0 ? (
          <p style={{ opacity: 0.7, marginTop: '1rem' }}>No profiles yet. Create one to get started.</p>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            {profiles.map(profile => (
              <div 
                key={profile.id} 
                style={{ 
                  border: profile.is_active ? '2px solid #3b82f6' : '1px solid #444', 
                  borderRadius: '4px', 
                  padding: '1rem', 
                  marginBottom: '1rem',
                  backgroundColor: profile.is_active ? '#3b82f610' : 'transparent'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0 }}>{profile.name}</h3>
                      {profile.is_active && (
                        <span style={{
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p style={{ opacity: 0.8, marginBottom: '0.5rem' }}>{profile.description}</p>
                    <div style={{ fontSize: '0.875rem', opacity: 0.6 }}>
                      {profile.commands.length} commands
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {!profile.is_active && (
                      <button 
                        onClick={() => handleSetActive(profile.id!)} 
                        style={{ 
                          padding: '0.5rem 1rem',
                          backgroundColor: '#10b981',
                          color: 'white'
                        }}
                      >
                        Set as Active
                      </button>
                    )}
                    <button onClick={() => handleEdit(profile)} style={{ padding: '0.5rem 1rem' }}>
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(profile.id!)} 
                      style={{ 
                        padding: '0.5rem 1rem', 
                        backgroundColor: '#ef4444', 
                        color: 'white' 
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

