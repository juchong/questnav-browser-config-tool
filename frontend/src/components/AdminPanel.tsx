import { useState, useEffect } from 'react';
import { ConfigProfile, AdbCommand } from '../types';
import { api } from '../services/apiService';
import { githubService } from '../services/githubService';

const CATEGORIES = ['refresh_rate', 'performance', 'display', 'privacy', 'system', 'diagnostic', 'app_install'] as const;

interface AdminPanelProps {
  onLogout: () => void;
}

interface ApkDownloadState {
  [commandIndex: number]: {
    status: 'not_downloaded' | 'downloading' | 'ready' | 'error';
    hash?: string;
    size?: number;
    error?: string;
  };
}

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [profiles, setProfiles] = useState<ConfigProfile[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<ConfigProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [apkDownloadStates, setApkDownloadStates] = useState<ApkDownloadState>({});

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
      setApkDownloadStates({}); // Clear download states
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save profile');
    }
  };

  const handleDownloadApk = async (commandIndex: number) => {
    if (!editingProfile) return;
    
    const cmd = editingProfile.commands[commandIndex];
    if (cmd.category !== 'app_install' || !cmd.apk_url || !cmd.apk_name) return;

    // Clear existing hash if re-downloading
    if (cmd.apk_hash) {
      const newCommands = [...editingProfile.commands];
      newCommands[commandIndex] = {
        ...newCommands[commandIndex],
        apk_hash: undefined
      };
      setEditingProfile({ ...editingProfile, commands: newCommands });
    }

    // Set downloading state
    setApkDownloadStates(prev => ({
      ...prev,
      [commandIndex]: { status: 'downloading' }
    }));

    try {
      const response = await fetch('/api/apks/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apk_url: cmd.apk_url,
          apk_name: cmd.apk_name
        })
      });

      const data = await response.json();

      if (data.success && data.data.hash) {
        // Update command with hash
        const newCommands = [...editingProfile.commands];
        newCommands[commandIndex] = {
          ...newCommands[commandIndex],
          apk_hash: data.data.hash
        };
        setEditingProfile({ ...editingProfile, commands: newCommands });

        // Set ready state
        setApkDownloadStates(prev => ({
          ...prev,
          [commandIndex]: {
            status: 'ready',
            hash: data.data.hash,
            size: data.data.size
          }
        }));
      } else {
        setApkDownloadStates(prev => ({
          ...prev,
          [commandIndex]: {
            status: 'error',
            error: data.error || 'Download failed'
          }
        }));
      }
    } catch (err) {
      setApkDownloadStates(prev => ({
        ...prev,
        [commandIndex]: {
          status: 'error',
          error: err instanceof Error ? err.message : 'Network error'
        }
      }));
    }
  };

  const getApkStatus = (commandIndex: number, cmd: AdbCommand) => {
    // First check if we're currently downloading
    const downloadState = apkDownloadStates[commandIndex];
    if (downloadState && downloadState.status !== 'ready') {
      return downloadState;
    }
    
    // Check if already has hash (either from DB or just downloaded)
    if (cmd.apk_hash) {
      return downloadState || { status: 'ready' as const, hash: cmd.apk_hash };
    }
    
    // Check download state
    return downloadState || { status: 'not_downloaded' as const };
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

  const addDiagnosticCommand = () => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      commands: [
        ...editingProfile.commands,
        { 
          command: 'dumpsys tracking', 
          description: 'Collect tracking diagnostic data', 
          category: 'diagnostic' 
        }
      ]
    });
  };

  const addAppInstallCommand = async () => {
    if (!editingProfile) return;
    
    // Try to fetch latest QuestNav APK info
    const latestApk = await githubService.getLatestApkUrl();
    
    setEditingProfile({
      ...editingProfile,
      commands: [
        ...editingProfile.commands,
        { 
          command: 'install_apk', // Placeholder command, actual installation handled by frontend
          description: latestApk ? `Install ${latestApk.name} (${latestApk.version})` : 'Install APK', 
          category: 'app_install',
          apk_url: latestApk?.url || '',
          apk_name: latestApk?.name || 'app.apk'
        }
      ]
    });
  };

  const updateCommand = (index: number, field: keyof AdbCommand, value: string | boolean) => {
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

  const moveCommandUp = (index: number) => {
    if (!editingProfile || index === 0) return;
    const newCommands = [...editingProfile.commands];
    [newCommands[index - 1], newCommands[index]] = [newCommands[index], newCommands[index - 1]];
    setEditingProfile({ ...editingProfile, commands: newCommands });
  };

  const moveCommandDown = (index: number) => {
    if (!editingProfile || index === editingProfile.commands.length - 1) return;
    const newCommands = [...editingProfile.commands];
    [newCommands[index], newCommands[index + 1]] = [newCommands[index + 1], newCommands[index]];
    setEditingProfile({ ...editingProfile, commands: newCommands });
  };

  // Export utility function
  const downloadJSON = (data: any, filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportProfiles = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJSON(profiles, `questnav-profiles-${timestamp}.json`);
  };

  const handleExportLogs = async () => {
    try {
      const logs = await api.getLogs(1000); // Export up to 1000 logs
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadJSON(logs, `questnav-logs-${timestamp}.json`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export logs');
    }
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

      {/* Export Data */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>Export Data</h2>
        <p style={{ opacity: 0.8, marginBottom: '1rem' }}>
          Download your data in JSON format for backup or analysis.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            onClick={handleExportProfiles}
            style={{ 
              backgroundColor: '#8b5cf6', 
              color: 'white',
              padding: '0.75rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span>📦</span>
            Export Profiles ({profiles.length})
          </button>
          <button 
            onClick={handleExportLogs}
            style={{ 
              backgroundColor: '#06b6d4', 
              color: 'white',
              padding: '0.75rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span>📊</span>
            Export Logs (up to 1000)
          </button>
        </div>
        <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#3b82f610', borderRadius: '4px', fontSize: '0.875rem', opacity: 0.8 }}>
          <strong>💡 Tip:</strong> Exported files include timestamps in their names for easy organization. 
          Logs include full command results, browser info, and device details.
        </div>
      </div>

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ marginBottom: '0.25rem' }}>Commands</h3>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                  {editingProfile.commands.length} total • {editingProfile.commands.filter(cmd => !cmd.is_hidden).length} user-facing
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={addCommand} style={{ backgroundColor: '#3b82f6', color: 'white' }}>
                  Add Command
                </button>
                <button 
                  onClick={addDiagnosticCommand} 
                  style={{ 
                    backgroundColor: '#8b5cf6', 
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  title="Add dumpsys tracking diagnostic command"
                >
                  <span style={{ fontSize: '1.2em' }}>🔬</span>
                  Add Diagnostic
                </button>
                <button 
                  onClick={addAppInstallCommand} 
                  style={{ 
                    backgroundColor: '#10b981', 
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  title="Add APK installation command (e.g., QuestNav)"
                >
                  <span style={{ fontSize: '1.2em' }}>📦</span>
                  Add App Install
                </button>
              </div>
            </div>
            
            {editingProfile.commands.map((cmd, idx) => (
              <div key={idx} style={{ 
                border: '1px solid #444', 
                borderRadius: '4px', 
                padding: '1rem', 
                marginBottom: '1rem', 
                backgroundColor: cmd.category === 'diagnostic' ? '#8b5cf610' : cmd.category === 'app_install' ? '#10b98110' : 'transparent',
                opacity: cmd.is_hidden ? 0.6 : 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong>Command {idx + 1}</strong>
                    {cmd.category === 'diagnostic' && (
                      <span style={{ 
                        backgroundColor: '#8b5cf6', 
                        color: 'white', 
                        padding: '0.125rem 0.375rem', 
                        borderRadius: '3px', 
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        DIAGNOSTIC
                      </span>
                    )}
                    {cmd.category === 'app_install' && (
                      <span style={{ 
                        backgroundColor: '#10b981', 
                        color: 'white', 
                        padding: '0.125rem 0.375rem', 
                        borderRadius: '3px', 
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        APP INSTALL
                      </span>
                    )}
                    {cmd.is_hidden && (
                      <span style={{ 
                        backgroundColor: '#6b7280', 
                        color: 'white', 
                        padding: '0.125rem 0.375rem', 
                        borderRadius: '3px', 
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        HIDDEN
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button 
                      onClick={() => moveCommandUp(idx)} 
                      disabled={idx === 0}
                      style={{ 
                        padding: '0.25rem 0.5rem', 
                        fontSize: '0.875rem',
                        opacity: idx === 0 ? 0.3 : 1,
                        cursor: idx === 0 ? 'not-allowed' : 'pointer'
                      }}
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button 
                      onClick={() => moveCommandDown(idx)} 
                      disabled={idx === editingProfile.commands.length - 1}
                      style={{ 
                        padding: '0.25rem 0.5rem', 
                        fontSize: '0.875rem',
                        opacity: idx === editingProfile.commands.length - 1 ? 0.3 : 1,
                        cursor: idx === editingProfile.commands.length - 1 ? 'not-allowed' : 'pointer'
                      }}
                      title="Move down"
                    >
                      ▼
                    </button>
                    <button 
                      onClick={() => removeCommand(idx)} 
                      style={{ 
                        padding: '0.25rem 0.5rem', 
                        fontSize: '0.875rem',
                        backgroundColor: '#ef4444',
                        color: 'white'
                      }}
                    >
                      Remove
                    </button>
                  </div>
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
                    color: 'inherit',
                    marginBottom: '0.5rem'
                  }}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Visibility Toggle */}
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  cursor: 'pointer',
                  marginTop: '0.75rem',
                  padding: '0.5rem',
                  backgroundColor: '#44444410',
                  borderRadius: '4px',
                  fontSize: '0.875rem'
                }}>
                  <input
                    type="checkbox"
                    checked={cmd.is_hidden || false}
                    onChange={(e) => updateCommand(idx, 'is_hidden', e.target.checked)}
                    style={{
                      cursor: 'pointer',
                      width: '1rem',
                      height: '1rem'
                    }}
                  />
                  <span>Hide this command from users</span>
                </label>

                {/* APK-specific fields for app_install category */}
                {cmd.category === 'app_install' && (
                  <>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', marginTop: '0.5rem' }}>APK Name:</label>
                    <input
                      type="text"
                      value={cmd.apk_name || ''}
                      onChange={(e) => {
                        const newCommands = [...editingProfile.commands];
                        newCommands[idx] = { ...newCommands[idx], apk_name: e.target.value };
                        setEditingProfile({ ...editingProfile, commands: newCommands });
                      }}
                      placeholder="e.g., QuestNav.apk"
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

                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>APK URL:</label>
                    <input
                      type="url"
                      value={cmd.apk_url || ''}
                      onChange={(e) => {
                        const newCommands = [...editingProfile.commands];
                        newCommands[idx] = { ...newCommands[idx], apk_url: e.target.value };
                        setEditingProfile({ ...editingProfile, commands: newCommands });
                      }}
                      placeholder="https://github.com/QuestNav/QuestNav/releases/download/..."
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

                    {/* Download Button and Status */}
                    {(() => {
                      const apkStatus = getApkStatus(idx, cmd);
                      return (
                        <div style={{ 
                          marginTop: '0.5rem', 
                          padding: '0.75rem', 
                          backgroundColor: apkStatus.status === 'ready' ? '#10b98115' : 
                                          apkStatus.status === 'error' ? '#ef444415' : 
                                          apkStatus.status === 'downloading' ? '#3b82f615' : '#44444410',
                          borderRadius: '4px',
                          border: `1px solid ${apkStatus.status === 'ready' ? '#10b981' : 
                                               apkStatus.status === 'error' ? '#ef4444' : 
                                               apkStatus.status === 'downloading' ? '#3b82f6' : '#444'}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ flex: 1, minWidth: '200px' }}>
                            {apkStatus.status === 'not_downloaded' && (
                              <div style={{ fontSize: '0.875rem' }}>
                                <strong>⚠️ APK not downloaded</strong>
                                <div style={{ opacity: 0.7, fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                  Click "Download APK" to cache this file
                                </div>
                              </div>
                            )}
                            {apkStatus.status === 'downloading' && (
                              <div style={{ fontSize: '0.875rem', color: '#3b82f6' }}>
                                <strong>⏳ Downloading APK...</strong>
                                <div style={{ opacity: 0.7, fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                  Please wait...
                                </div>
                              </div>
                            )}
                            {apkStatus.status === 'ready' && (
                              <div style={{ fontSize: '0.875rem', color: '#10b981' }}>
                                <strong>✓ APK Ready</strong>
                                <div style={{ opacity: 0.8, fontSize: '0.75rem', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                                  Hash: {apkStatus.hash?.substring(0, 16)}...
                                  {apkStatus.size && ` • ${(apkStatus.size / 1024 / 1024).toFixed(2)} MB`}
                                </div>
                              </div>
                            )}
                            {apkStatus.status === 'error' && (
                              <div style={{ fontSize: '0.875rem', color: '#ef4444' }}>
                                <strong>❌ Download Failed</strong>
                                <div style={{ opacity: 0.8, fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                  {apkStatus.error || 'Unknown error'}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {(apkStatus.status === 'not_downloaded' || apkStatus.status === 'error') && (
                            <button
                              onClick={() => handleDownloadApk(idx)}
                              disabled={!cmd.apk_url || !cmd.apk_name}
                              style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: !cmd.apk_url || !cmd.apk_name ? 'not-allowed' : 'pointer',
                                opacity: !cmd.apk_url || !cmd.apk_name ? 0.5 : 1,
                                fontWeight: 'bold',
                                fontSize: '0.875rem'
                              }}
                            >
                              {apkStatus.status === 'error' ? 'Retry Download' : 'Download APK'}
                            </button>
                          )}
                          
                          {apkStatus.status === 'ready' && (
                            <button
                              onClick={() => handleDownloadApk(idx)}
                              style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#6b7280',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '0.875rem'
                              }}
                            >
                              Re-download
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.5rem' }}>
                      💡 Tip: Download APK before saving to ensure it's ready for users
                    </div>
                  </>
                )}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', opacity: 0.6, flexWrap: 'wrap' }}>
                      <span>
                        {profile.commands.length} total command{profile.commands.length !== 1 ? 's' : ''}
                        {' • '}
                        {profile.commands.filter(cmd => !cmd.is_hidden).length} user-facing
                      </span>
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

