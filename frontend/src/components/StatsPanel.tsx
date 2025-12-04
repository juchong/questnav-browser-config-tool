import { useState, useEffect } from 'react';
import { api, ExtendedStats, IgnoredSerial, AvailableSerial } from '../services/apiService';

interface StatsPanelProps {
  basicStats: {
    total: number;
    success: number;
    failure: number;
    successRate: number;
  } | null;
  ignoredSerials: IgnoredSerial[];
  availableSerials: AvailableSerial[];
  onAddIgnoredSerial: (serial: string, label?: string) => void;
  onRemoveIgnoredSerial: (id: number) => void;
}

export default function StatsPanel({ 
  basicStats, 
  ignoredSerials, 
  availableSerials, 
  onAddIgnoredSerial, 
  onRemoveIgnoredSerial 
}: StatsPanelProps) {
  const [extendedStats, setExtendedStats] = useState<ExtendedStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(30);
  const [showExtended, setShowExtended] = useState(false);
  const [showIgnoredSerials, setShowIgnoredSerials] = useState(false);

  useEffect(() => {
    if (showExtended) {
      loadExtendedStats();
    }
  }, [showExtended, selectedDays]);

  const loadExtendedStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getExtendedStats(selectedDays);
      setExtendedStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load extended stats');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number | null): string => {
    if (ms === null) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'success': return '#4ade80';
      case 'failure': return '#ef4444';
      case 'partial': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'success': return '✓';
      case 'failure': return '✗';
      case 'partial': return '⚠';
      default: return '?';
    }
  };

  // Calculate max for bar scaling
  const getMaxDaily = (): number => {
    if (!extendedStats?.daily.length) return 1;
    return Math.max(...extendedStats.daily.map(d => d.total), 1);
  };

  const getMaxBrowser = (): number => {
    if (!extendedStats?.browsers.length) return 1;
    return Math.max(...extendedStats.browsers.map(b => b.count), 1);
  };

  const getMaxOS = (): number => {
    if (!extendedStats?.operatingSystems.length) return 1;
    return Math.max(...extendedStats.operatingSystems.map(o => o.count), 1);
  };

  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Statistics</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowIgnoredSerials(!showIgnoredSerials)}
            style={{
              backgroundColor: showIgnoredSerials ? '#ef4444' : 'transparent',
              color: showIgnoredSerials ? 'white' : '#ef4444',
              border: '1px solid #ef4444',
              padding: '0.5rem 0.75rem',
              fontSize: '0.8rem'
            }}
            title="Exclude devices from analytics"
          >
            {showIgnoredSerials ? 'Close' : `Excluded (${ignoredSerials.length})`}
          </button>
          <button
            onClick={() => setShowExtended(!showExtended)}
            style={{
              backgroundColor: showExtended ? '#6b7280' : '#3b82f6',
              color: 'white',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem'
            }}
          >
            {showExtended ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>

      {/* Excluded Devices Management */}
      {showIgnoredSerials && (
        <div style={{ 
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '1rem' }}>
            Exclude specific devices from all analytics to filter out development/testing data.
          </p>
          
          {/* Currently Excluded */}
          {ignoredSerials.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Currently Excluded
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {ignoredSerials.map(item => (
                  <div 
                    key={item.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      padding: '0.375rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace'
                    }}
                    title={item.label ? `${item.label} (${item.serial})` : item.serial}
                  >
                    <span style={{ color: '#ef4444' }}>
                      {item.serial}
                    </span>
                    <button
                      onClick={() => onRemoveIgnoredSerial(item.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '0',
                        fontSize: '1rem',
                        lineHeight: 1
                      }}
                      title={`Remove ${item.serial}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Devices */}
          {availableSerials.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Click to Exclude
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {availableSerials.map(device => (
                  <button
                    key={device.serial}
                    onClick={() => onAddIgnoredSerial(device.serial, device.device_name)}
                    style={{
                      backgroundColor: 'var(--card-bg, #2a2a2a)',
                      border: '1px solid var(--border-color, #444)',
                      borderRadius: '4px',
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      color: 'inherit',
                      fontFamily: 'monospace'
                    }}
                    title={`${device.device_name || 'Unknown Device'} - ${device.execution_count} executions`}
                  >
                    {device.serial}
                    <span style={{ opacity: 0.5, marginLeft: '0.5rem', fontFamily: 'inherit' }}>({device.execution_count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {ignoredSerials.length === 0 && availableSerials.length === 0 && (
            <p style={{ opacity: 0.5, fontStyle: 'italic', fontSize: '0.8rem', margin: 0 }}>
              No devices with recorded executions yet.
            </p>
          )}
        </div>
      )}

      {/* Basic Stats - Always visible */}
      {basicStats && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
          gap: '1rem', 
          marginBottom: showExtended ? '2rem' : 0 
        }}>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: 'var(--card-bg, #1a1a1a)', 
            borderRadius: '8px',
            border: '1px solid var(--border-color, #333)'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{basicStats.total}</div>
            <div style={{ opacity: 0.7, fontSize: '0.875rem' }}>Total Executions</div>
          </div>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: 'var(--card-bg, #1a1a1a)', 
            borderRadius: '8px',
            border: '1px solid #4ade8040'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4ade80' }}>{basicStats.success}</div>
            <div style={{ opacity: 0.7, fontSize: '0.875rem' }}>Successful</div>
          </div>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: 'var(--card-bg, #1a1a1a)', 
            borderRadius: '8px',
            border: '1px solid #ef444440'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>{basicStats.failure}</div>
            <div style={{ opacity: 0.7, fontSize: '0.875rem' }}>Failed</div>
          </div>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: 'var(--card-bg, #1a1a1a)', 
            borderRadius: '8px',
            border: '1px solid var(--border-color, #333)'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{basicStats.successRate.toFixed(1)}%</div>
            <div style={{ opacity: 0.7, fontSize: '0.875rem' }}>Success Rate</div>
          </div>
        </div>
      )}

      {/* Extended Stats */}
      {showExtended && (
        <>
          {/* Time Period Selector */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            marginBottom: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <span style={{ opacity: 0.7, alignSelf: 'center', marginRight: '0.5rem' }}>Time Period:</span>
            {[7, 14, 30, 90].map(days => (
              <button
                key={days}
                onClick={() => setSelectedDays(days)}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.875rem',
                  backgroundColor: selectedDays === days ? '#3b82f6' : 'transparent',
                  color: selectedDays === days ? 'white' : 'inherit',
                  border: `1px solid ${selectedDays === days ? '#3b82f6' : '#444'}`
                }}
              >
                {days}d
              </button>
            ))}
          </div>

          {loading && (
            <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.7 }}>
              Loading detailed statistics...
            </div>
          )}

          {error && (
            <div style={{ 
              padding: '1rem', 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              borderRadius: '8px',
              color: '#ef4444',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          {extendedStats && !loading && (
            <>
              {/* Period Summary */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                gap: '1rem',
                marginBottom: '2rem'
              }}>
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                    LAST {extendedStats.period.days} DAYS
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{extendedStats.period.total}</div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                    {extendedStats.period.successRate.toFixed(1)}% success rate
                  </div>
                </div>
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: 'rgba(139, 92, 246, 0.1)', 
                  borderRadius: '8px',
                  border: '1px solid rgba(139, 92, 246, 0.3)'
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                    UNIQUE DEVICES
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{extendedStats.devices.uniqueCount}</div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                    in this period
                  </div>
                </div>
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                  borderRadius: '8px',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                    AVG DURATION
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {formatDuration(extendedStats.duration.avgMs)}
                  </div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                    per execution
                  </div>
                </div>
              </div>

              {/* Daily Activity Chart */}
              {extendedStats.daily.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Daily Activity</h3>
                  <div style={{ 
                    display: 'flex',
                    backgroundColor: 'var(--card-bg, #1a1a1a)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #333)',
                    padding: '0.75rem'
                  }}>
                    {/* Y-axis label */}
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                      fontSize: '0.625rem',
                      opacity: 0.5,
                      paddingRight: '0.25rem',
                      fontWeight: 500
                    }}>
                      Executions
                    </div>
                    {/* Y-axis scale */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                      paddingRight: '0.5rem',
                      fontSize: '0.625rem',
                      opacity: 0.5,
                      height: '100px',
                      minWidth: '24px'
                    }}>
                      <span>{getMaxDaily()}</span>
                      <span>{Math.round(getMaxDaily() / 2)}</span>
                      <span>0</span>
                    </div>
                    {/* Chart area */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'flex-end', 
                      gap: '2px',
                      flex: 1,
                      height: '100px',
                      borderLeft: '1px solid var(--border-color, #444)',
                      borderBottom: '1px solid var(--border-color, #444)',
                      paddingLeft: '4px',
                      overflowX: 'auto'
                    }}>
                      {extendedStats.daily.map((day, idx) => {
                        const maxVal = getMaxDaily();
                        return (
                          <div 
                            key={idx} 
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column',
                              alignItems: 'center',
                              minWidth: '20px',
                              flex: 1,
                              maxWidth: '36px'
                            }}
                            title={`${formatDate(day.date)}\n${day.total} total: ${day.success} success, ${day.failure} failed`}
                          >
                            {/* Count label on top of bar */}
                            {day.total > 0 && (
                              <div style={{ 
                                fontSize: '0.625rem', 
                                opacity: 0.7, 
                                marginBottom: '2px',
                                fontWeight: 500
                              }}>
                                {day.total}
                              </div>
                            )}
                            <div style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              width: '100%',
                              height: '70px',
                              justifyContent: 'flex-end'
                            }}>
                              {day.failure > 0 && (
                                <div style={{
                                  height: `${(day.failure / maxVal) * 70}px`,
                                  backgroundColor: '#ef4444',
                                  borderRadius: '2px 2px 0 0',
                                  minHeight: '2px'
                                }} />
                              )}
                              {day.success > 0 && (
                                <div style={{
                                  height: `${(day.success / maxVal) * 70}px`,
                                  backgroundColor: '#4ade80',
                                  borderRadius: day.failure > 0 ? '0' : '2px 2px 0 0',
                                  minHeight: '2px'
                                }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* X-axis date labels */}
                  <div style={{ 
                    display: 'flex',
                    paddingLeft: '52px',
                    marginTop: '4px'
                  }}>
                    {extendedStats.daily.map((day, idx) => (
                      <div 
                        key={idx}
                        style={{ 
                          flex: 1, 
                          minWidth: '20px', 
                          maxWidth: '36px',
                          fontSize: '0.625rem',
                          opacity: 0.5,
                          textAlign: 'center'
                        }}
                      >
                        {idx === 0 || idx === extendedStats.daily.length - 1 || idx % Math.ceil(extendedStats.daily.length / 5) === 0 
                          ? formatDate(day.date) 
                          : ''
                        }
                      </div>
                    ))}
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    marginTop: '0.75rem',
                    fontSize: '0.75rem',
                    opacity: 0.7
                  }}>
                    <span><span style={{ color: '#4ade80' }}>■</span> Success</span>
                    <span><span style={{ color: '#ef4444' }}>■</span> Failed</span>
                    <span style={{ marginLeft: 'auto', opacity: 0.6 }}>
                      Period total: {extendedStats.daily.reduce((sum, d) => sum + d.total, 0)} executions
                    </span>
                  </div>
                </div>
              )}

              {/* Browser & OS Breakdown */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                {/* Browser Stats */}
                {extendedStats.browsers.length > 0 && (
                  <div>
                    <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Browsers</h3>
                    <div style={{ 
                      backgroundColor: 'var(--card-bg, #1a1a1a)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #333)',
                      padding: '0.75rem'
                    }}>
                      {extendedStats.browsers.slice(0, 5).map((b, idx) => (
                        <div key={idx} style={{ marginBottom: idx < 4 ? '0.5rem' : 0 }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            fontSize: '0.875rem',
                            marginBottom: '0.25rem'
                          }}>
                            <span>{b.browser}</span>
                            <span style={{ opacity: 0.7 }}>{b.count}</span>
                          </div>
                          <div style={{
                            height: '4px',
                            backgroundColor: '#333',
                            borderRadius: '2px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${(b.count / getMaxBrowser()) * 100}%`,
                              height: '100%',
                              backgroundColor: '#3b82f6',
                              borderRadius: '2px'
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* OS Stats */}
                {extendedStats.operatingSystems.length > 0 && (
                  <div>
                    <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Operating Systems</h3>
                    <div style={{ 
                      backgroundColor: 'var(--card-bg, #1a1a1a)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #333)',
                      padding: '0.75rem'
                    }}>
                      {extendedStats.operatingSystems.slice(0, 5).map((o, idx) => (
                        <div key={idx} style={{ marginBottom: idx < 4 ? '0.5rem' : 0 }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            fontSize: '0.875rem',
                            marginBottom: '0.25rem'
                          }}>
                            <span>{o.os}</span>
                            <span style={{ opacity: 0.7 }}>{o.count}</span>
                          </div>
                          <div style={{
                            height: '4px',
                            backgroundColor: '#333',
                            borderRadius: '2px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${(o.count / getMaxOS()) * 100}%`,
                              height: '100%',
                              backgroundColor: '#8b5cf6',
                              borderRadius: '2px'
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Executions */}
              {extendedStats.recentExecutions.length > 0 && (
                <div>
                  <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Recent Activity</h3>
                  <div style={{ 
                    backgroundColor: 'var(--card-bg, #1a1a1a)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #333)',
                    overflow: 'hidden'
                  }}>
                    {/* Table Header */}
                    <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: '60px 1fr 1fr 1fr 100px 100px 80px',
                      gap: '1rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderBottom: '1px solid var(--border-color, #333)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      opacity: 0.6,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      textAlign: 'center'
                    }}>
                      <span>Status</span>
                      <span>Device</span>
                      <span>Platform</span>
                      <span>Commands</span>
                      <span>App Installed?</span>
                      <span>Time</span>
                      <span>Duration</span>
                    </div>
                    {/* Table Body */}
                    {extendedStats.recentExecutions.map((exec, idx) => {
                      // Build tooltip for failed commands
                      const failedTooltip = exec.failed_command_details && exec.failed_command_details.length > 0
                        ? `Failed commands:\n${exec.failed_command_details.map(f => `• ${f.description}: ${f.error}`).join('\n')}`
                        : '';
                      
                      // Build device tooltip with serial and IP
                      const deviceTooltip = [
                        exec.device_serial ? `Serial: ${exec.device_serial}` : null,
                        exec.client_ip ? `IP: ${exec.client_ip}` : null
                      ].filter(Boolean).join('\n');
                      
                      return (
                        <div 
                          key={exec.id}
                          style={{ 
                            display: 'grid',
                            gridTemplateColumns: '60px 1fr 1fr 1fr 100px 100px 80px',
                            gap: '1rem',
                            alignItems: 'center',
                            padding: '0.75rem 1rem',
                            borderBottom: idx < extendedStats.recentExecutions.length - 1 ? '1px solid var(--border-color, #333)' : 'none',
                            fontSize: '0.8125rem',
                            textAlign: 'center'
                          }}
                        >
                          {/* Status */}
                          <div 
                            style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: failedTooltip ? 'help' : 'default'
                            }}
                            title={failedTooltip || undefined}
                          >
                            <span style={{ 
                              color: getStatusColor(exec.status),
                              fontWeight: 'bold',
                              fontSize: '1rem'
                            }}>
                              {getStatusIcon(exec.status)}
                            </span>
                          </div>
                          
                          {/* Device Name */}
                          <span 
                            style={{ 
                              opacity: 0.9,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              cursor: deviceTooltip ? 'help' : 'default'
                            }}
                            title={deviceTooltip || undefined}
                          >
                            {exec.device_name || 'Unknown Device'}
                          </span>
                          
                          {/* Platform (Browser + OS) */}
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            fontSize: '0.75rem',
                            lineHeight: 1.4,
                            alignItems: 'center'
                          }}>
                            <span style={{ opacity: 0.9 }}>{exec.browser_name || 'Unknown'}</span>
                            <span style={{ opacity: 0.5 }}>{exec.os_name || 'Unknown OS'}</span>
                          </div>
                          
                          {/* Command Results */}
                          <div 
                            style={{ 
                              fontSize: '0.8rem', 
                              cursor: failedTooltip ? 'help' : 'default',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                            title={failedTooltip || undefined}
                          >
                            {exec.total_commands !== null ? (
                              <>
                                <span style={{ color: '#4ade80', fontWeight: 500 }}>{exec.successful_commands ?? 0}</span>
                                <span style={{ opacity: 0.4 }}>/</span>
                                <span style={{ opacity: 0.7 }}>{exec.total_commands}</span>
                                {(exec.failed_commands ?? 0) > 0 && (
                                  <span style={{ 
                                    color: '#ef4444', 
                                    fontSize: '0.75rem',
                                    marginLeft: '0.25rem',
                                    textDecoration: 'underline dotted',
                                    textUnderlineOffset: '2px'
                                  }}>
                                    {exec.failed_commands}✗
                                  </span>
                                )}
                              </>
                            ) : (
                              <span style={{ opacity: 0.4 }}>—</span>
                            )}
                          </div>
                          
                          {/* App Install Status */}
                          <div style={{ 
                            fontSize: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                          }}>
                            {exec.questnav_installed ? (
                              <>
                                <span style={{ color: '#10b981' }}>✓ Yes</span>
                                {exec.questnav_version && (
                                  <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>
                                    {exec.questnav_version === 'installed' ? 'Installed' : exec.questnav_version}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span style={{ opacity: 0.4 }}>No</span>
                            )}
                          </div>
                          
                          {/* Timestamp */}
                          <div style={{ 
                            opacity: 0.6, 
                            fontSize: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            lineHeight: 1.4
                          }}>
                            <span>{new Date(exec.executed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            <span style={{ opacity: 0.7 }}>{new Date(exec.executed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          
                          {/* Duration */}
                          <span style={{ 
                            opacity: 0.7, 
                            fontSize: '0.8rem',
                            fontFamily: 'monospace',
                            fontWeight: 500
                          }}>
                            {formatDuration(exec.execution_duration_ms)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Summary footer */}
                  <div style={{ 
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    opacity: 0.5,
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>Showing last {extendedStats.recentExecutions.length} executions</span>
                    <span>
                      {extendedStats.recentExecutions.filter(e => e.status === 'success').length} successful, {' '}
                      {extendedStats.recentExecutions.filter(e => e.status === 'failure').length} failed, {' '}
                      {extendedStats.recentExecutions.filter(e => e.status === 'partial').length} partial
                    </span>
                  </div>
                </div>
              )}

            </>
          )}
        </>
      )}
    </div>
  );
}

