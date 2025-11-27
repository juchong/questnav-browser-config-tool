import { useState, useEffect } from 'react';
import { ConfigProfile, AdbCommand } from '../types';
import { api } from '../services/apiService';
import { githubService } from '../services/githubService';
import ApkReleasesPanel from './ApkReleasesPanel';

const CATEGORIES = ['refresh_rate', 'performance', 'display', 'privacy', 'system', 'diagnostic', 'app_install'] as const;

/**
 * Validate commands for common mistakes
 * Returns array of warning messages
 */
function validateCommands(commands: AdbCommand[]): string[] {
  const warnings: string[] = [];
  
  commands.forEach((cmd, index) => {
    // Skip app_install commands (they don't use shell commands)
    if (cmd.category === 'app_install') return;
    
    const command = cmd.command.trim();
    const lowerCommand = command.toLowerCase();
    
    // Check for adb prefixes (common mistake)
    if (lowerCommand.startsWith('adb ')) {
      warnings.push(
        `Command ${index + 1} ("${cmd.description}"): Remove "adb" prefix. Commands are already executed through ADB.`
      );
    }
    
    if (lowerCommand.startsWith('adb shell ')) {
      warnings.push(
        `Command ${index + 1} ("${cmd.description}"): Remove "adb shell" prefix. Commands are already in shell context.`
      );
    }
    
    // Check for nested adb shell (like in the command text)
    if (lowerCommand.includes("adb shell '") || lowerCommand.includes('adb shell "')) {
      warnings.push(
        `Command ${index + 1} ("${cmd.description}"): Contains nested "adb shell" - this will fail on the device.`
      );
    }
    
    // Check for windows-style paths (might indicate copy-paste from local script)
    if (command.match(/[A-Z]:\\/)) {
      warnings.push(
        `Command ${index + 1} ("${cmd.description}"): Contains Windows path (e.g., C:\\). This will fail on Android.`
      );
    }
    
    // Check for excessive whitespace or newlines
    if (command.includes('\n') || command.includes('\r')) {
      warnings.push(
        `Command ${index + 1} ("${cmd.description}"): Contains newlines. Multi-line commands may not execute correctly.`
      );
    }
  });
  
  return warnings;
}

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
  const [cachedReleases, setCachedReleases] = useState<Array<{
    id: number;
    release_tag: string;
    apk_name: string;
    apk_hash: string;
    apk_size: number;
  }>>([]);

  useEffect(() => {
    loadData();
    loadCachedReleases();
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

  const loadCachedReleases = async () => {
    try {
      const response = await fetch('/api/admin/apk-releases', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        // Only include completed releases with hash
        const completed = data.data
          .filter((r: any) => r.download_status === 'completed' && r.apk_hash)
          .map((r: any) => ({
            id: r.id,
            release_tag: r.release_tag,
            apk_name: r.apk_name,
            apk_hash: r.apk_hash,
            apk_size: r.apk_size
          }));
        setCachedReleases(completed);
      }
    } catch (err) {
      console.error('Failed to load cached releases:', err);
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

    // Validate commands before saving
    const warnings = validateCommands(editingProfile.commands);
    
    if (warnings.length > 0) {
      const warningMessage = 
        '⚠️ Command Validation Warnings:\n\n' +
        warnings.map((w, i) => `${i + 1}. ${w}`).join('\n\n') +
        '\n\nDo you want to save anyway?';
      
      if (!confirm(warningMessage)) {
        return; // User cancelled
      }
    }

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

  const handleImportProfiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedProfiles = JSON.parse(text) as ConfigProfile[];

      // Validate that it's an array
      if (!Array.isArray(importedProfiles)) {
        alert('Invalid file format: Expected an array of profiles');
        return;
      }

      // Validate each profile
      for (const profile of importedProfiles) {
        if (!profile.name || !profile.commands || !Array.isArray(profile.commands)) {
          alert(`Invalid profile format: ${profile.name || 'Unknown'}`);
          return;
        }
      }

      // Check for duplicate names
      const existingNames = new Set(profiles.map(p => p.name.toLowerCase()));
      const duplicates: string[] = [];
      const toImport: ConfigProfile[] = [];

      for (const profile of importedProfiles) {
        if (existingNames.has(profile.name.toLowerCase())) {
          duplicates.push(profile.name);
        } else {
          toImport.push(profile);
        }
      }

      // Handle duplicates
      if (duplicates.length > 0) {
        const dupeList = duplicates.join(', ');
        const action = confirm(
          `Found ${duplicates.length} duplicate profile name(s): ${dupeList}\n\n` +
          `Click OK to skip duplicates and import ${toImport.length} new profile(s).\n` +
          `Click Cancel to abort the entire import.`
        );

        if (!action) {
          // Reset file input
          event.target.value = '';
          return;
        }

        if (toImport.length === 0) {
          alert('No profiles to import (all were duplicates)');
          event.target.value = '';
          return;
        }
      }

      // Import profiles
      let successCount = 0;
      let failCount = 0;

      for (const profile of toImport) {
        try {
          // Remove id and timestamps - let server assign new ones
          const { id, created_at, updated_at, is_active, ...profileData } = profile;
          await api.createProfile(profileData);
          successCount++;
        } catch (err) {
          console.error(`Failed to import profile: ${profile.name}`, err);
          failCount++;
        }
      }

      // Show results
      const message = [
        `Import completed!`,
        `✓ Successfully imported: ${successCount}`,
        failCount > 0 ? `✗ Failed: ${failCount}` : '',
        duplicates.length > 0 ? `⊘ Skipped duplicates: ${duplicates.length}` : ''
      ].filter(Boolean).join('\n');

      alert(message);

      // Reload data
      await loadData();
      
      // Reset file input for next use
      event.target.value = '';
    } catch (err) {
      console.error('Import failed:', err);
      alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      event.target.value = '';
    }
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

      {/* APK Releases */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>QuestNav APK Releases</h2>
        <p style={{ opacity: 0.8, marginBottom: '1rem' }}>
          Automatically detected and manually managed APK releases from the QuestNav repository.
        </p>
        <ApkReleasesPanel />
      </div>

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
          <label 
            style={{ 
              backgroundColor: '#10b981', 
              color: 'white',
              padding: '0.75rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
              border: 'none',
              fontWeight: 'bold',
              fontSize: '1rem'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.opacity = '1';
            }}
          >
            <span>📥</span>
            Import Profiles
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportProfiles}
              style={{ display: 'none' }}
            />
          </label>
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
          <strong>💡 Tip:</strong> Use Export/Import for backup and sharing configurations across deployments. 
          Duplicate profile names are automatically detected and skipped during import.
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
                  Dump Tracking
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
                        DUMP TRACKING
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
                
                {/* Inline command validation warnings */}
                {cmd.category !== 'app_install' && (() => {
                  const cmdLower = cmd.command.toLowerCase().trim();
                  const warnings: string[] = [];
                  
                  if (cmdLower.startsWith('adb shell ')) {
                    warnings.push('⚠️ Remove "adb shell" prefix - commands are already in shell context');
                  } else if (cmdLower.startsWith('adb ')) {
                    warnings.push('⚠️ Remove "adb" prefix - commands are already executed through ADB');
                  }
                  
                  if (cmdLower.includes("adb shell '") || cmdLower.includes('adb shell "')) {
                    warnings.push('⚠️ Contains nested "adb shell" - this will fail on device');
                  }
                  
                  if (cmd.command.match(/[A-Z]:\\/)) {
                    warnings.push('⚠️ Contains Windows path (e.g., C:\\) - this will fail on Android');
                  }
                  
                  if (cmd.command.includes('\n') || cmd.command.includes('\r')) {
                    warnings.push('⚠️ Contains newlines - multi-line commands may not execute correctly');
                  }
                  
                  return warnings.length > 0 ? (
                    <div style={{
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      marginBottom: '0.5rem',
                      border: '1px solid #fbbf24'
                    }}>
                      {warnings.map((warning, i) => (
                        <div key={i} style={{ marginBottom: i < warnings.length - 1 ? '0.25rem' : 0 }}>
                          {warning}
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}
                
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
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', marginTop: '0.5rem' }}>Select Cached APK:</label>
                    <select
                      value={cmd.apk_hash || ''}
                      onChange={(e) => {
                        const selectedHash = e.target.value;
                        const selectedRelease = cachedReleases.find(r => r.apk_hash === selectedHash);
                        
                        if (selectedRelease) {
                          const newCommands = [...editingProfile.commands];
                          newCommands[idx] = {
                            ...newCommands[idx],
                            apk_hash: selectedRelease.apk_hash,
                            apk_name: selectedRelease.apk_name,
                            apk_url: `/api/apks/${selectedRelease.apk_hash}`,
                            command: 'install_apk'
                          };
                          setEditingProfile({ ...editingProfile, commands: newCommands });
                        }
                      }}
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
                      <option value="">-- Select a cached release --</option>
                      {cachedReleases.map((release) => (
                        <option key={release.id} value={release.apk_hash}>
                          {release.release_tag} - {release.apk_name} ({(release.apk_size / 1024 / 1024).toFixed(2)} MB)
                        </option>
                      ))}
                    </select>

                    {cachedReleases.length === 0 && (
                      <div style={{
                        padding: '0.75rem',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid #f59e0b',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        marginBottom: '0.5rem'
                      }}>
                        <strong>⚠️ No cached releases available.</strong>
                        <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>
                          Go to the "QuestNav APK Releases" section above and download some releases first.
                        </p>
                      </div>
                    )}

                    {cmd.apk_hash && (
                      <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#10b98115',
                        border: '1px solid #10b981',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        marginTop: '0.5rem'
                      }}>
                        <div style={{ marginBottom: '0.25rem', color: '#10b981' }}><strong>✓ APK Ready</strong></div>
                        <div style={{ opacity: 0.8, fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          Name: {cmd.apk_name}
                        </div>
                        <div style={{ opacity: 0.8, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          Hash: {cmd.apk_hash.substring(0, 16)}...
                        </div>
                      </div>
                    )}

                    <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.5rem' }}>
                      💡 Tip: APKs are served from the cache. No need to download separately.
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

