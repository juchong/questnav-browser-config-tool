import { useState } from 'react';
import ConnectionStatus from './components/ConnectionStatus';
import ConfigurationPanel from './components/ConfigurationPanel';
import ProgressDisplay from './components/ProgressDisplay';
import AdminPanel from './components/AdminPanel';
import { adbService } from './services/adbService';
import { api } from './services/apiService';
import { ConnectionState, ExecutionProgress, ConfigProfile } from './types';
import './index.css';

function App() {
  const [view, setView] = useState<'user' | 'admin'>('user');
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    connected: false
  });
  const [progress, setProgress] = useState<ExecutionProgress>({
    total: 0,
    completed: 0,
    status: 'idle'
  });
  const [isExecuting, setIsExecuting] = useState(false);

  // Check WebUSB support
  const isWebUsbSupported = adbService.isSupported();

  const handleConnect = async () => {
    setProgress({ ...progress, status: 'idle', error: undefined });
    const result = await adbService.connect();
    
    if (result.success && result.device) {
      setConnectionState({
        connected: true,
        device: result.device
      });
    } else {
      alert(`Connection failed: ${result.error}`);
    }
  };

  const handleDisconnect = async () => {
    await adbService.disconnect();
    setConnectionState({ connected: false });
    setProgress({
      total: 0,
      completed: 0,
      status: 'idle'
    });
  };

  const handleApplyConfiguration = async (profile: ConfigProfile) => {
    if (!connectionState.connected) {
      alert('Please connect to your Quest device first.');
      return;
    }

    if (!profile.commands || profile.commands.length === 0) {
      alert('This profile has no commands to execute.');
      return;
    }

    setIsExecuting(true);
    setProgress({
      total: profile.commands.length,
      completed: 0,
      status: 'running',
      current: profile.commands[0].description
    });

    try {
      const commands = profile.commands.map(cmd => cmd.command);
      
      const results = await adbService.executeCommands(
        commands,
        (current, total, command) => {
          const currentCommand = profile.commands[current];
          setProgress({
            total,
            completed: current,
            status: 'running',
            current: currentCommand?.description || ''
          });
        }
      );

      // Check if any commands failed
      const failures = results.filter(r => !r.success);
      
      if (failures.length === 0) {
        setProgress({
          total: profile.commands.length,
          completed: profile.commands.length,
          status: 'success'
        });
        
        // Log success
        if (profile.id) {
          await api.logExecution({
            profile_id: profile.id,
            status: 'success'
          });
        }
      } else if (failures.length === results.length) {
        setProgress({
          total: profile.commands.length,
          completed: 0,
          status: 'error',
          error: failures[0].error || 'All commands failed'
        });
        
        // Log failure
        if (profile.id) {
          await api.logExecution({
            profile_id: profile.id,
            status: 'failure',
            error_message: failures[0].error
          });
        }
      } else {
        setProgress({
          total: profile.commands.length,
          completed: results.filter(r => r.success).length,
          status: 'error',
          error: `${failures.length} commands failed`
        });
        
        // Log partial success
        if (profile.id) {
          await api.logExecution({
            profile_id: profile.id,
            status: 'partial',
            error_message: `${failures.length} commands failed`
          });
        }
      }
    } catch (error) {
      setProgress({
        total: profile.commands.length,
        completed: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Log error
      if (profile.id) {
        await api.logExecution({
          profile_id: profile.id,
          status: 'failure',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isWebUsbSupported) {
    return (
      <div>
        <h1>Quest Configuration Tool</h1>
        <div className="card" style={{ backgroundColor: '#ef4444', color: 'white' }}>
          <h2>WebUSB Not Supported</h2>
          <p>
            Your browser doesn't support WebUSB, which is required for this tool to work.
          </p>
          <p style={{ marginTop: '1rem' }}>
            Please use a Chromium-based browser such as:
          </p>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
            <li>Google Chrome</li>
            <li>Microsoft Edge</li>
            <li>Brave</li>
            <li>Opera</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Quest Configuration Tool</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setView('user')}
            style={{
              backgroundColor: view === 'user' ? '#3b82f6' : undefined,
              color: view === 'user' ? 'white' : undefined
            }}
          >
            User View
          </button>
          <button
            onClick={() => setView('admin')}
            style={{
              backgroundColor: view === 'admin' ? '#3b82f6' : undefined,
              color: view === 'admin' ? 'white' : undefined
            }}
          >
            Admin Panel
          </button>
        </div>
      </div>

      {view === 'admin' ? (
        <AdminPanel />
      ) : (
        <>
          <ConnectionStatus
            state={connectionState}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            disabled={isExecuting}
          />

          {connectionState.connected && (
            <>
              <ConfigurationPanel
                onSelectProfile={handleApplyConfiguration}
                disabled={isExecuting}
              />
              
              {(progress.status !== 'idle') && (
                <ProgressDisplay progress={progress} />
              )}
            </>
          )}

          {!connectionState.connected && (
            <div className="card">
              <h2>Welcome!</h2>
              <p>This tool allows you to quickly configure your Meta Quest headset with optimized settings.</p>
              <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Before you begin:</h3>
              <ol style={{ paddingLeft: '1.5rem', lineHeight: 1.8 }}>
                <li>Enable Developer Mode on your Quest headset</li>
                <li>Connect your Quest to this computer via USB cable</li>
                <li>Click "Connect Quest" button above</li>
                <li>Allow USB debugging when prompted on your headset</li>
                <li>Select a configuration profile and click "Apply Configuration"</li>
              </ol>
              <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#3b82f620', borderRadius: '4px' }}>
                <strong>Need help enabling Developer Mode?</strong>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  Visit the Meta Quest Developer Center and follow the instructions to create a developer account and enable Developer Mode in the Meta Quest mobile app.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;

