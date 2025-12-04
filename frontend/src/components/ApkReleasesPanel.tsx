import { useState, useEffect } from 'react';

interface ApkRelease {
  id: number;
  release_tag: string;
  release_name: string;
  apk_name: string;
  apk_url: string;
  apk_hash?: string;
  apk_size?: number;
  download_status: 'pending' | 'downloading' | 'completed' | 'failed';
  download_error?: string;
  published_at?: string;
  detected_at: string;
  downloaded_at?: string;
  source: 'webhook' | 'manual' | 'poll';
}

export default function ApkReleasesPanel() {
  const [releases, setReleases] = useState<ApkRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhookInfo, setWebhookInfo] = useState<{ secretConfigured: boolean } | null>(null);
  const [backfillStatus, setBackfillStatus] = useState<{ hasReleases: boolean; releaseCount: number; completedCount: number } | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  useEffect(() => {
    loadReleases();
    checkWebhookStatus();
    checkBackfillStatus();
  }, []);

  const loadReleases = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/apk-releases', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setReleases(data.data);
      } else {
        setError(data.error || 'Failed to load releases');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load releases');
    } finally {
      setLoading(false);
    }
  };

  const checkWebhookStatus = async () => {
    try {
      const response = await fetch('/api/webhooks/github');
      const data = await response.json();
      if (data.success) {
        setWebhookInfo(data.data);
      }
    } catch (err) {
      console.error('Failed to check webhook status:', err);
    }
  };

  const checkBackfillStatus = async () => {
    try {
      const response = await fetch('/api/admin/apk-releases/backfill-status', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setBackfillStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to check backfill status:', err);
    }
  };

  const handleBackfill = async (autoDownload: boolean = false) => {
    if (!confirm(`This will fetch up to 30 historical releases from GitHub${autoDownload ? ' and automatically download them' : ''}. Continue?`)) {
      return;
    }

    try {
      setIsBackfilling(true);
      const response = await fetch('/api/admin/apk-releases/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ maxReleases: 30, autoDownload })
      });
      const data = await response.json();
      
      if (data.success) {
        const result = data.data;
        alert(`Backfill completed!\n\nAdded: ${result.stats.added}\nSkipped: ${result.stats.skipped}\nFailed: ${result.stats.failed}`);
        await loadReleases();
        await checkBackfillStatus();
      } else {
        alert(data.error || 'Backfill failed');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Backfill failed');
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleDownload = async (id: number) => {
    try {
      const response = await fetch(`/api/admin/apk-releases/${id}/download`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        // Reload to show updated status
        setTimeout(() => loadReleases(), 1000);
      } else {
        alert(data.error || 'Failed to trigger download');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to trigger download');
    }
  };

  const handleDelete = async (id: number, tag: string) => {
    if (!confirm(`Delete release ${tag} and its cached APK?`)) return;

    try {
      const response = await fetch(`/api/admin/apk-releases/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        await loadReleases();
      } else {
        alert(data.error || 'Failed to delete release');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete release');
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'downloading': return '#3b82f6';
      case 'failed': return '#ef4444';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'downloading': return '⟳';
      case 'failed': return '✗';
      case 'pending': return '○';
      default: return '?';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'downloading': return 'Downloading';
      case 'failed': return 'Failed';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'webhook': return 'Webhook';
      case 'manual': return 'Manual';
      case 'poll': return 'Backfill';
      default: return source;
    }
  };

  if (loading) return <div>Loading releases...</div>;

  return (
    <div>
      {/* Webhook Status */}
      <div style={{
        padding: '1rem',
        borderRadius: '6px',
        backgroundColor: webhookInfo?.secretConfigured ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
        border: `1px solid ${webhookInfo?.secretConfigured ? '#10b981' : '#f59e0b'}`,
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>
            {webhookInfo?.secretConfigured ? '✓' : '⚠'}
          </span>
          <strong>
            {webhookInfo?.secretConfigured ? 'Webhook Configured' : 'Webhook Not Configured'}
          </strong>
        </div>
        <p style={{ fontSize: '0.875rem', opacity: 0.8, margin: 0 }}>
          {webhookInfo?.secretConfigured
            ? 'GitHub webhooks will automatically detect new QuestNav releases.'
            : 'Configure GITHUB_WEBHOOK_SECRET in environment variables to enable automatic detection.'}
        </p>
        <details style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: '500' }}>Setup Instructions</summary>
          <ol style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', lineHeight: 1.6 }}>
            <li>Go to the QuestNav repository settings on GitHub</li>
            <li>Navigate to Webhooks → Add webhook</li>
            <li>Set Payload URL to: <code style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '0.125rem 0.25rem', borderRadius: '3px' }}>https://your-domain.com/api/webhooks/github</code></li>
            <li>Set Content type to: <code style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '0.125rem 0.25rem', borderRadius: '3px' }}>application/json</code></li>
            <li>Set Secret to a random string and add it to your .env as <code style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '0.125rem 0.25rem', borderRadius: '3px' }}>GITHUB_WEBHOOK_SECRET</code></li>
            <li>Select "Let me select individual events" and check only "Releases"</li>
            <li>Click "Add webhook"</li>
          </ol>
        </details>
      </div>

      {/* Releases List */}
      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Backfill prompt for empty list */}
      {!loading && releases.length === 0 && backfillStatus && !backfillStatus.hasReleases && (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '6px',
          marginBottom: '1rem'
        }}>
          <h3 style={{ marginBottom: '1rem' }}>No Releases Found</h3>
          <p style={{ opacity: 0.8, marginBottom: '1.5rem' }}>
            Load historical releases from the QuestNav GitHub repository to get started.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleBackfill(false)}
              disabled={isBackfilling}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isBackfilling ? 'not-allowed' : 'pointer',
                opacity: isBackfilling ? 0.6 : 1,
                fontWeight: '500'
              }}
            >
              {isBackfilling ? 'Loading...' : '📥 Load Historical Releases'}
            </button>
            <button
              onClick={() => handleBackfill(true)}
              disabled={isBackfilling}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isBackfilling ? 'not-allowed' : 'pointer',
                opacity: isBackfilling ? 0.6 : 1,
                fontWeight: '500'
              }}
            >
              {isBackfilling ? 'Loading...' : '📥 Load & Download All'}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '1rem' }}>
            This will fetch up to 30 most recent releases from GitHub
          </p>
        </div>
      )}

      {releases.length === 0 && !backfillStatus?.hasReleases ? null : releases.length === 0 ? (
        <p style={{ opacity: 0.7, textAlign: 'center', padding: '2rem' }}>
          No releases detected yet. Releases will appear here automatically when new versions are published.
        </p>
      ) : (
        <>
          {/* Collapsible Table Header */}
          <button
            onClick={() => setIsTableExpanded(!isTableExpanded)}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: 'var(--surface-color)',
              border: '1px solid rgba(128, 128, 128, 0.2)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.95rem',
              fontWeight: '500',
              marginBottom: isTableExpanded ? '0.5rem' : '1rem',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--hover-color)';
              e.currentTarget.style.borderColor = 'rgba(128, 128, 128, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface-color)';
              e.currentTarget.style.borderColor = 'rgba(128, 128, 128, 0.2)';
            }}
          >
            <span>{isTableExpanded ? 'Hide' : 'Show'} Release Details ({releases.length} release{releases.length !== 1 ? 's' : ''})</span>
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{
                transform: isTableExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {isTableExpanded && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-color)', borderBottom: '2px solid rgba(128, 128, 128, 0.2)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Release</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>APK Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Size</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Published</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Source</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {releases.map((release) => (
                    <tr key={release.id} style={{ borderBottom: '1px solid rgba(128, 128, 128, 0.1)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: getStatusColor(release.download_status) + '20',
                          color: getStatusColor(release.download_status),
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          <span>{getStatusIcon(release.download_status)}</span>
                          <span>{getStatusLabel(release.download_status)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: '500' }}>{release.release_tag}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{release.release_name}</div>
                      </td>
                      <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {release.apk_name}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {formatSize(release.apk_size)}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.75rem' }}>
                        {formatDate(release.published_at)}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          padding: '0.125rem 0.375rem',
                          borderRadius: '3px',
                          backgroundColor: 'rgba(128, 128, 128, 0.1)',
                          fontSize: '0.75rem'
                        }}>
                          {getSourceLabel(release.source)}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {(release.download_status === 'pending' || release.download_status === 'failed') && (
                            <button
                              onClick={() => handleDownload(release.id)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                              title={release.download_status === 'failed' ? `Retry (Error: ${release.download_error})` : 'Download APK'}
                            >
                              {release.download_status === 'failed' ? 'Retry' : 'Download'}
                            </button>
                          )}
                          {release.download_status === 'completed' && release.apk_hash && (
                            <a
                              href={`/api/apks/${release.apk_hash}`}
                              download={release.apk_name}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Download APK file"
                            >
                              Get APK
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(release.id, release.release_tag)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                            title="Delete release and cached APK"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Refresh Button */}
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {releases.length > 0 && (
            <>
              <button
                onClick={() => handleBackfill(false)}
                disabled={isBackfilling}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--surface-color)',
                  border: '1px solid rgba(128, 128, 128, 0.2)',
                  borderRadius: '6px',
                  cursor: isBackfilling ? 'not-allowed' : 'pointer',
                  opacity: isBackfilling ? 0.6 : 1,
                  fontSize: '0.875rem'
                }}
                title="Load historical releases from GitHub"
              >
                📥 Backfill Releases
              </button>
            </>
          )}
        </div>
        <button
          onClick={loadReleases}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--surface-color)',
            border: '1px solid rgba(128, 128, 128, 0.2)',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}

