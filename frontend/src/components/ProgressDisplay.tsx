import { ExecutionProgress } from '../types';

interface ProgressDisplayProps {
  progress: ExecutionProgress;
}

export default function ProgressDisplay({ progress }: ProgressDisplayProps) {
  const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  const getStatusColorClass = () => {
    switch (progress.status) {
      case 'success': return 'text-success';
      case 'error': return 'text-error';
      case 'running': return 'text-primary';
      default: return 'text-muted';
    }
  };

  const getProgressBarClass = () => {
    switch (progress.status) {
      case 'success': return 'bg-success';
      case 'error': return 'bg-error';
      case 'running': return 'bg-primary';
      default: return '';
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
              backgroundColor: 'var(--surface-color)',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '1rem'
            }}
          >
            <div
              className={getProgressBarClass()}
              style={{
                width: `${percentage}%`,
                height: '100%',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
          <div style={{ opacity: 0.8 }}>
            {progress.completed} of {progress.total} commands executed
          </div>
          {progress.current && (
            <div style={{ opacity: 0.7, marginTop: '0.5rem' }}>
              Current: {progress.current}
            </div>
          )}
        </>
      )}

      {progress.status === 'success' && (
        <div className={getStatusColorClass()}>
          All {progress.total} commands executed successfully!
        </div>
      )}

      {progress.status === 'error' && (
        <div>
          <div className={getStatusColorClass()} style={{ marginBottom: '0.5rem' }}>
            Failed at command {progress.completed + 1} of {progress.total}
          </div>
          {progress.error && (
            <div style={{ opacity: 0.8 }}>
              Error: {progress.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

