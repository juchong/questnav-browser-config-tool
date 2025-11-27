import { useState } from 'react';
import { AdbCommand } from '../types';

interface CommandPreviewProps {
  commands: AdbCommand[];
  includeQuestNav?: boolean;
  questNavInfo?: { version: string; name: string } | null;
}

export default function CommandPreview({ commands, includeQuestNav, questNavInfo }: CommandPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter out hidden commands
  const visibleCommands = commands.filter(cmd => !cmd.is_hidden);
  
  // Check if profile already has an app_install command
  const hasAppInstall = commands.some(cmd => cmd.category === 'app_install');
  
  // Calculate total commands based on includeQuestNav state
  let totalCommands: number;
  
  if (includeQuestNav) {
    // User wants to install: count all visible commands + QuestNav if not already present
    totalCommands = hasAppInstall ? visibleCommands.length : visibleCommands.length + 1;
  } else {
    // User doesn't want to install: exclude app_install commands from count
    totalCommands = visibleCommands.filter(cmd => cmd.category !== 'app_install').length;
  }
  
  // Only show QuestNav in the table if user opted in AND profile doesn't already have app_install
  const shouldShowQuestNav = includeQuestNav && !hasAppInstall;

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      'refresh_rate': 'Refresh Rate',
      'performance': 'Performance',
      'display': 'Display',
      'privacy': 'Privacy',
      'system': 'System',
      'diagnostic': 'Dump Tracking',
      'app_install': 'App Install'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'refresh_rate': '#3b82f6',
      'performance': '#8b5cf6',
      'display': '#06b6d4',
      'privacy': '#f59e0b',
      'system': '#6366f1',
      'diagnostic': '#64748b',
      'app_install': '#10b981'
    };
    return colors[category] || '#64748b';
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
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
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          {isExpanded ? 'Hide' : 'View'} Command Details ({totalCommands} command{totalCommands !== 1 ? 's' : ''})
        </span>
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
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isExpanded && (
        <div style={{
          marginTop: '0.5rem',
          border: '1px solid rgba(128, 128, 128, 0.2)',
          borderRadius: '6px',
          overflow: 'hidden',
          backgroundColor: 'var(--surface-color)'
        }}>
          <div style={{
            overflowX: 'auto'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem'
            }}>
              <thead>
                <tr style={{
                  backgroundColor: 'var(--bg-color)',
                  borderBottom: '2px solid rgba(128, 128, 128, 0.2)'
                }}>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}>
                    #
                  </th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}>
                    Category
                  </th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    minWidth: '200px'
                  }}>
                    Description
                  </th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    minWidth: '250px'
                  }}>
                    Command
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Regular commands */}
                {visibleCommands
                  .filter(cmd => includeQuestNav || cmd.category !== 'app_install')
                  .map((cmd, idx) => {
                    // Calculate proper index considering filtered commands
                    const displayIndex = idx + 1;
                    const isLastCommand = idx === visibleCommands.filter(c => includeQuestNav || c.category !== 'app_install').length - 1;
                    
                    return (
                      <tr 
                        key={idx}
                        style={{
                          borderBottom: (!isLastCommand || shouldShowQuestNav) ? '1px solid rgba(128, 128, 128, 0.1)' : 'none'
                        }}
                      >
                        <td style={{ padding: '0.75rem', opacity: 0.7 }}>
                          {displayIndex}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            backgroundColor: getCategoryColor(cmd.category) + '20',
                            color: getCategoryColor(cmd.category)
                          }}>
                            {getCategoryLabel(cmd.category)}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {cmd.description}
                        </td>
                        <td style={{ 
                          padding: '0.75rem',
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          color: 'var(--color-muted)',
                          wordBreak: 'break-all'
                        }}>
                          {cmd.command}
                        </td>
                      </tr>
                    );
                  })}

                {/* QuestNav APK if included (and profile doesn't already have app_install) - show at END */}
                {shouldShowQuestNav && questNavInfo && (
                  <tr style={{
                    borderBottom: 'none'
                  }}>
                    <td style={{ padding: '0.75rem', opacity: 0.7 }}>
                      {visibleCommands.filter(cmd => includeQuestNav || cmd.category !== 'app_install').length + 1}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: getCategoryColor('app_install') + '20',
                        color: getCategoryColor('app_install')
                      }}>
                        {getCategoryLabel('app_install')}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      Install QuestNav APK
                    </td>
                    <td style={{ 
                      padding: '0.75rem',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      color: 'var(--color-muted)',
                      wordBreak: 'break-all'
                    }}>
                      install_apk
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

