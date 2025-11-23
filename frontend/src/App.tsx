import { useState, useEffect } from 'react';
import ConnectionStatus from './components/ConnectionStatus';
import ConfigurationPanel from './components/ConfigurationPanel';
import ProgressDisplay from './components/ProgressDisplay';
import AdminPanel from './components/AdminPanel';
import ErrorHelp from './components/ErrorHelp';
import AuthenticationStatus from './components/AuthenticationStatus';
import Login from './components/Login';
import { adbService } from './services/adbService';
import { api } from './services/apiService';
import { authService } from './services/authService';
import { ConnectionState, ExecutionProgress, ConfigProfile } from './types';
import './index.css';

interface ConnectionStatusInfo {
  stage: 'selecting' | 'connecting' | 'authenticating';
  message: string;
  timeRemaining?: number;
}

function App() {
  const [view, setView] = useState<'user' | 'admin'>('user');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    connected: false
  });
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionStatusInfo, setConnectionStatusInfo] = useState<ConnectionStatusInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [progress, setProgress] = useState<ExecutionProgress>({
    total: 0,
    completed: 0,
    status: 'idle'
  });
  const [isExecuting, setIsExecuting] = useState(false);

  // Check authentication status on mount and when switching to admin view
  useEffect(() => {
    const checkAuth = async () => {
      if (view === 'admin') {
        setIsCheckingAuth(true);
        const isAuth = await authService.checkAuth();
        setIsAuthenticated(isAuth);
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, [view]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await authService.logout();
    setIsAuthenticated(false);
  };

  // Check WebUSB support
  const isWebUsbSupported = adbService.isSupported();

  const handleConnect = async () => {
    setProgress({ ...progress, status: 'idle', error: undefined });
    setConnectionError(null);
    setConnectionStatusInfo(null);
    setIsConnecting(true);
    
    // Use the status callback to show connection progress
    const result = await adbService.connect((status) => {
      // Show status messages during connection
      if (status.stage === 'authenticating' || status.stage === 'connecting' || status.stage === 'selecting') {
        setConnectionStatusInfo({
          stage: status.stage,
          message: status.message,
          timeRemaining: status.timeRemaining
        });
        setConnectionError(null); // Clear any previous errors
      } else if (status.stage === 'error') {
        setConnectionStatusInfo(null);
        setConnectionError(status.message);
      }
    });
    
    setIsConnecting(false);
    
    if (result.success && result.device) {
      setConnectionState({
        connected: true,
        device: result.device
      });
      setConnectionError(null);
      setConnectionStatusInfo(null);
    } else {
      setConnectionError(result.error || 'Failed to connect');
      setConnectionStatusInfo(null);
    }
  };

  const handleCancelConnection = () => {
    console.log('User requested connection cancellation');
    adbService.cancelConnection();
    setIsConnecting(false);
    setConnectionStatusInfo(null);
    setConnectionError('Connection cancelled by user.');
  };

  const handleDisconnect = async () => {
    await adbService.disconnect();
    setConnectionState({ connected: false });
    setConnectionError(null);
    setConnectionStatusInfo(null);
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
        (current, total) => {
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
        <h1>QuestNav Configuration Tool</h1>
        <div className="card" style={{ backgroundColor: '#ef4444', color: 'white' }}>
          <h2>WebUSB Not Supported</h2>
          <p>
            Your browser doesn't support WebUSB, which is required for this tool to work.
          </p>
          <p style={{ marginTop: '1rem' }}>
            Please use a Chromium-based browser such as:
          </p>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
            <li>Google Chrome (version 112 or later)</li>
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
        <h1>QuestNav Configuration Tool</h1>
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
        <>
          {isCheckingAuth ? (
            <div className="card">
              <p>Checking authentication...</p>
            </div>
          ) : isAuthenticated ? (
            <AdminPanel onLogout={handleLogout} />
          ) : (
            <Login onLoginSuccess={handleLoginSuccess} />
          )}
        </>
      ) : (
        <>
          <ConnectionStatus
            state={connectionState}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            disabled={isExecuting}
            isConnecting={isConnecting}
            onCancelConnection={handleCancelConnection}
          />

          {connectionStatusInfo && (
            <AuthenticationStatus
              stage={connectionStatusInfo.stage}
              message={connectionStatusInfo.message}
              timeRemaining={connectionStatusInfo.timeRemaining}
              onCancel={handleCancelConnection}
            />
          )}

          {connectionError && (
            <ErrorHelp 
              error={connectionError}
              onRetry={handleConnect}
              onDismiss={() => setConnectionError(null)}
            />
          )}

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
              
              <div style={{ 
                marginTop: '1.5rem', 
                padding: '1rem', 
                backgroundColor: '#3b82f620', 
                borderLeft: '4px solid #3b82f6',
                borderRadius: '4px' 
              }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#3b82f6' }}>
                  📱 Using from Android Phone?
                </h3>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                  Perfect! Connect your Quest to your phone using a USB-C cable. 
                  Most modern Android phones support USB OTG and work great with this tool.
                </p>
              </div>

              <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Before you begin:</h3>
              <ol style={{ paddingLeft: '1.5rem', lineHeight: 1.8 }}>
                <li>Enable Developer Mode on your Quest headset</li>
                <li>Connect your Quest via USB cable (to phone, Mac, or Linux PC)</li>
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

