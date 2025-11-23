import { ExecutionProgress } from '../types';

interface ProgressDisplayProps {
  progress: ExecutionProgress;
}

export default function ProgressDisplay({ progress }: ProgressDisplayProps) {
  const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  const getStatusColor = () => {
    switch (progress.status) {
      case 'success': return '#4ade80';
      case 'error': return '#ef4444';
      case 'running': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getStatusText = () => {
    switch (progress.status) {
      case 'success': return 'Configuration Complete!';
      case 'error': return 'Configuration Failed';
      case 'running': return 'Configuring...';
      default: return 'Ready';
    }
  };

  return (
    <div className="card">
      <h3 style={{ marginBottom: '1rem' }}>{getStatusText()}</h3>
      
      {progress.status === 'running' && (
        <>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#333',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '1rem'
            }}
          >
            <div
              style={{
                width: `${percentage}%`,
                height: '100%',
                backgroundColor: getStatusColor(),
                transition: 'width 0.3s ease'
              }}
            />
          </div>
          <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
            {progress.completed} of {progress.total} commands executed
          </div>
          {progress.current && (
            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.5rem' }}>
              Current: {progress.current}
            </div>
          )}
        </>
      )}

      {progress.status === 'success' && (
        <div style={{ color: getStatusColor() }}>
          All {progress.total} commands executed successfully!
        </div>
      )}

      {progress.status === 'error' && (
        <div>
          <div style={{ color: getStatusColor(), marginBottom: '0.5rem' }}>
            Failed at command {progress.completed + 1} of {progress.total}
          </div>
          {progress.error && (
            <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
              Error: {progress.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

