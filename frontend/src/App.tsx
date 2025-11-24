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
import { githubService } from './services/githubService';
import { ConnectionState, ExecutionProgress, ConfigProfile, CommandExecutionResult, AdbCommand } from './types';
import { collectBrowserInfo } from './utils/browserInfo';
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
  const [connectionTimestamp, setConnectionTimestamp] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionStatusInfo, setConnectionStatusInfo] = useState<ConnectionStatusInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [progress, setProgress] = useState<ExecutionProgress>({
    total: 0,
    completed: 0,
    status: 'idle'
  });
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Collect browser info once on mount
  const [browserInfo] = useState(() => collectBrowserInfo());

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
      setConnectionTimestamp(new Date().toISOString());
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
    setConnectionTimestamp(null);
    setConnectionError(null);
    setConnectionStatusInfo(null);
    setProgress({
      total: 0,
      completed: 0,
      status: 'idle'
    });
  };

  const handleApplyConfiguration = async (profile: ConfigProfile, installQuestNav: boolean = false) => {
    if (!connectionState.connected) {
      alert('Please connect to your Quest device first.');
      return;
    }

    // Build the full command list including optional QuestNav APK
    let allCommands: AdbCommand[] = [...profile.commands];
    
    // If user opted in for QuestNav, add it at the beginning (unless admin already added it)
    if (installQuestNav) {
      const hasQuestNavInstall = profile.commands.some(cmd => cmd.category === 'app_install');
      if (!hasQuestNavInstall) {
        // Fetch latest QuestNav APK info
        const apkInfo = await githubService.getLatestApkUrl();
        if (apkInfo) {
          // Request backend to cache the APK and get hash
          try {
            const cacheResponse = await fetch('/api/apks/cache', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                apk_url: apkInfo.url,
                apk_name: apkInfo.name
              })
            });
            
            const cacheData = await cacheResponse.json();
            
            if (cacheData.success && cacheData.data.hash) {
              // Insert QuestNav installation at the start with hash
              allCommands.unshift({
                command: 'install_apk',
                description: `Install ${apkInfo.name} (${apkInfo.version})`,
                category: 'app_install',
                apk_url: apkInfo.url,
                apk_name: apkInfo.name,
                apk_hash: cacheData.data.hash
              });
            } else {
              console.error('Failed to cache APK:', cacheData.error);
              alert(`Failed to prepare QuestNav APK: ${cacheData.error}`);
              return;
            }
          } catch (error) {
            console.error('Failed to cache APK:', error);
            alert('Failed to prepare QuestNav APK. Please try again.');
            return;
          }
        }
      }
    }

    if (allCommands.length === 0) {
      alert('This profile has no commands to execute.');
      return;
    }

    // Count visible commands for progress display
    const visibleCommands = allCommands.filter(cmd => !cmd.is_hidden);
    const visibleCount = visibleCommands.length;

    setIsExecuting(true);
    setProgress({
      total: visibleCount,
      completed: 0,
      status: 'running',
      current: allCommands[0].description
    });

    const executionStartTime = new Date().toISOString();
    const detailedResults: CommandExecutionResult[] = [];

    try {
      // Execute commands sequentially, handling app_install specially
      let currentIndex = 0;
      let visibleIndex = 0; // Track only visible commands for progress
      
      for (const cmd of allCommands) {
        // Only update progress for visible commands
        if (!cmd.is_hidden) {
          setProgress({
            total: visibleCount,
            completed: visibleIndex,
            status: 'running',
            current: cmd.description
          });
        }

        let result;
        
        if (cmd.category === 'app_install' && cmd.apk_hash && cmd.apk_name) {
          // Handle APK installation using cached hash
          result = await adbService.installApk(
            cmd.apk_hash,
            cmd.apk_name,
            (stage, _progress) => {
              // Only show progress for visible commands
              if (!cmd.is_hidden) {
                setProgress({
                  total: visibleCount,
                  completed: visibleIndex,
                  status: 'running',
                  current: `${cmd.description} - ${stage}`
                });
              }
            }
          );
          // console.log('APK install result for logging:', result);
        } else {
          // Regular command execution
          result = await adbService.executeCommand(cmd.command);
        }

        detailedResults.push({
          command: cmd.command,
          description: cmd.description,
          category: cmd.category,
          success: result.success,
          output: result.output,
          error: result.error,
          timestamp: result.timestamp || new Date().toISOString(),
          duration_ms: result.duration_ms || 0
        });
        
        // console.log(`Command ${currentIndex + 1}/${allCommands.length} result:`, {
        //   description: cmd.description,
        //   success: result.success,
        //   output: result.output?.substring(0, 100),
        //   error: result.error?.substring(0, 100)
        // });

        currentIndex++;
        // Only increment visible index for non-hidden commands
        if (!cmd.is_hidden) {
          visibleIndex++;
        }
        
        // Small delay between commands
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const executionEndTime = new Date().toISOString();

      // Check if any commands failed
      const failures = detailedResults.filter(r => !r.success);
      const successCount = detailedResults.filter(r => r.success).length;
      
      if (failures.length === 0) {
        setProgress({
          total: visibleCount,
          completed: visibleCount,
          status: 'success'
        });
        
        // Log success with full details
        if (profile.id) {
          await api.logExecution({
            profile_id: profile.id,
            status: 'success',
            device_serial: connectionState.device?.serial,
            device_name: connectionState.device?.name,
            connection_timestamp: connectionTimestamp || undefined,
            execution_start_timestamp: executionStartTime,
            execution_end_timestamp: executionEndTime,
            command_results: detailedResults,
            total_commands: allCommands.length,
            successful_commands: successCount,
            failed_commands: 0,
            ...browserInfo
          });
        }
      } else if (failures.length === allCommands.length) {
        setProgress({
          total: visibleCount,
          completed: 0,
          status: 'error',
          error: failures[0].error || 'All commands failed'
        });
        
        // Log failure with full details
        if (profile.id) {
          await api.logExecution({
            profile_id: profile.id,
            status: 'failure',
            error_message: failures[0].error,
            device_serial: connectionState.device?.serial,
            device_name: connectionState.device?.name,
            connection_timestamp: connectionTimestamp || undefined,
            execution_start_timestamp: executionStartTime,
            execution_end_timestamp: executionEndTime,
            command_results: detailedResults,
            total_commands: allCommands.length,
            successful_commands: 0,
            failed_commands: failures.length,
            ...browserInfo
          });
        }
      } else {
        // Count successful visible commands
        const successfulVisibleCount = detailedResults.filter((r, i) => 
          r.success && !allCommands[i].is_hidden
        ).length;
        
        setProgress({
          total: visibleCount,
          completed: successfulVisibleCount,
          status: 'error',
          error: `${failures.length} commands failed`
        });
        
        // Log partial success with full details
        if (profile.id) {
          await api.logExecution({
            profile_id: profile.id,
            status: 'partial',
            error_message: `${failures.length} commands failed`,
            device_serial: connectionState.device?.serial,
            device_name: connectionState.device?.name,
            connection_timestamp: connectionTimestamp || undefined,
            execution_start_timestamp: executionStartTime,
            execution_end_timestamp: executionEndTime,
            command_results: detailedResults,
            total_commands: allCommands.length,
            successful_commands: successCount,
            failed_commands: failures.length,
            ...browserInfo
          });
        }
      }
    } catch (error) {
      const executionEndTime = new Date().toISOString();
      
      setProgress({
        total: profile.commands.length,
        completed: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Log error with whatever details we have
      if (profile.id) {
        await api.logExecution({
          profile_id: profile.id,
          status: 'failure',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          device_serial: connectionState.device?.serial,
          device_name: connectionState.device?.name,
          connection_timestamp: connectionTimestamp || undefined,
          execution_start_timestamp: executionStartTime,
          execution_end_timestamp: executionEndTime,
          command_results: detailedResults.length > 0 ? detailedResults : undefined,
          total_commands: profile.commands.length,
          successful_commands: detailedResults.filter(r => r.success).length,
          failed_commands: detailedResults.filter(r => !r.success).length,
          ...browserInfo
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
        <div className="card bg-error" style={{ color: 'white' }}>
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
            className={`tab-button ${view === 'user' ? 'active' : ''}`}
            onClick={() => setView('user')}
          >
            User View
          </button>
          <button
            className={`tab-button ${view === 'admin' ? 'active' : ''}`}
            onClick={() => setView('admin')}
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
              
              <div className="info-box">
                <h3>
                  📱 Using from Android Phone?
                </h3>
                <p>
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
              <div className="info-box" style={{ marginTop: '1.5rem' }}>
                <strong>Need help enabling Developer Mode?</strong>
                <p>
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

