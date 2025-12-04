import { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import ConnectionStatus from './components/ConnectionStatus';
import ProgressDisplay from './components/ProgressDisplay';
import AdminPanel from './components/AdminPanel';
import ErrorHelp from './components/ErrorHelp';
import AuthenticationStatus from './components/AuthenticationStatus';
import Login from './components/Login';
import ThemeToggle from './components/ThemeToggle';
import Logo from './components/Logo';
import { adbService } from './services/adbService';
import { api } from './services/apiService';
import { authService } from './services/authService';
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
  const [installQuestNav, setInstallQuestNav] = useState(true); // State for QuestNav installation
  const [selectedApkHash, setSelectedApkHash] = useState<string>(''); // State for selected APK version
  const [profile, setProfile] = useState<ConfigProfile | null>(null); // State for loaded profile
  const [showConfetti, setShowConfetti] = useState(false); // State for confetti celebration
  const [windowDimensions, setWindowDimensions] = useState({ 
    width: window.innerWidth, 
    height: window.innerHeight 
  });
  
  // Collect browser info once on mount
  const [browserInfo] = useState(() => collectBrowserInfo());

  // Load profile on mount (not dependent on connection)
  useEffect(() => {
    loadProfile();
  }, []);

  // Update window dimensions on resize for confetti
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Warn user before closing/navigating away during configuration
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExecuting) {
        // Modern browsers require returnValue to be set
        e.preventDefault();
        e.returnValue = '';
        // Some browsers show this message, others show a generic one
        return 'Configuration is in progress. Are you sure you want to leave? This may interrupt the process.';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isExecuting]);

  // Update page title during execution to remind user not to close
  useEffect(() => {
    const originalTitle = document.title;
    
    if (isExecuting) {
      document.title = '⚠️ Configuration in Progress - QuestNav Setup';
    } else {
      document.title = originalTitle;
    }

    return () => {
      document.title = originalTitle;
    };
  }, [isExecuting]);

  const loadProfile = async () => {
    try {
      const data = await api.getProfiles();
      if (data.length > 0) {
        setProfile(data[0]);
        if (import.meta.env.VITE_DEBUG_MODE === 'true') {
          console.log('[DEBUG] Loaded profile:', data[0].name);
          console.log('[DEBUG] Total commands:', data[0].commands.length);
          // Log command 21 specifically (index 20)
          if (data[0].commands[20]) {
            console.log('[DEBUG] Command 21 details:', {
              description: data[0].commands[20].description,
              command: data[0].commands[20].command,
              category: data[0].commands[20].category
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

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
    if (import.meta.env.VITE_DEBUG_MODE === 'true') {
      console.log('[DEBUG] handleApplyConfiguration called');
      console.log('[DEBUG] connectionState:', connectionState);
    }
    
    if (!connectionState.connected) {
      alert('Please connect to your Quest device first.');
      return;
    }

    // Build the full command list including optional QuestNav APK
    let allCommands: AdbCommand[] = [...profile.commands];
    
    // Filter commands based on requires_questnav condition
    allCommands = allCommands.filter(cmd => {
      // If command has no condition, always include it
      if (!cmd.requires_questnav) return true;
      // If condition is 'with', only include if user is installing QuestNav
      if (cmd.requires_questnav === 'with') return installQuestNav;
      // If condition is 'without', only include if user is NOT installing QuestNav
      if (cmd.requires_questnav === 'without') return !installQuestNav;
      return true;
    });
    
    // If user opted in for QuestNav, add it at the end (unless admin already added it)
    if (installQuestNav) {
      const hasQuestNavInstall = allCommands.some(cmd => cmd.category === 'app_install');
      if (!hasQuestNavInstall && selectedApkHash) {
        // Use the selected cached APK - add at the END
        allCommands.push({
          command: 'install_apk',
          description: `Install QuestNav APK`,
          category: 'app_install',
          apk_url: `/api/apks/${selectedApkHash}`,
          apk_name: 'QuestNav.apk',
          apk_hash: selectedApkHash
        });
      }
    } else {
      // If user opted out, filter out any app_install commands from the profile
      allCommands = allCommands.filter(cmd => cmd.category !== 'app_install');
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
      if (import.meta.env.VITE_DEBUG_MODE === 'true') {
        console.log('[DEBUG] Starting command execution, total commands:', allCommands.length);
      }
      // Execute commands sequentially, handling app_install specially
      let currentIndex = 0;
      let visibleIndex = 0; // Track only visible commands for progress
      
      for (const cmd of allCommands) {
        if (import.meta.env.VITE_DEBUG_MODE === 'true') {
          console.log(`[DEBUG] About to execute command ${currentIndex + 1}:`, cmd.description);
        }
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
          if (import.meta.env.VITE_DEBUG_MODE === 'true') {
            console.log('[APK DEBUG] APK install result for logging:', result);
          }
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
        
        if (import.meta.env.VITE_DEBUG_MODE === 'true') {
          console.log(`[DEBUG] Command ${currentIndex + 1}/${allCommands.length} result:`, {
            description: cmd.description,
            success: result.success,
            output: result.output?.substring(0, 100),
            error: result.error?.substring(0, 100)
          });
        }

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
        
        // Trigger confetti celebration!
        setShowConfetti(true);
        
        // Log success with full details
        if (profile.id) {
          // Find QuestNav version from executed app_install commands
          const questNavCmd = allCommands.find(cmd => cmd.category === 'app_install');
          const questNavVersion = questNavCmd?.description?.match(/v[\d.]+/)?.[0] || 
                                  questNavCmd?.apk_name?.match(/v[\d.]+/)?.[0] || 
                                  (questNavCmd ? 'unknown' : undefined);
          
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
            questnav_installed: installQuestNav,
            questnav_version: installQuestNav ? questNavVersion : undefined,
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
          const questNavCmd = allCommands.find(cmd => cmd.category === 'app_install');
          const questNavVersion = questNavCmd?.description?.match(/v[\d.]+/)?.[0] || 
                                  questNavCmd?.apk_name?.match(/v[\d.]+/)?.[0] || 
                                  (questNavCmd ? 'unknown' : undefined);
          
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
            questnav_installed: installQuestNav,
            questnav_version: installQuestNav ? questNavVersion : undefined,
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
          const questNavCmd = allCommands.find(cmd => cmd.category === 'app_install');
          const questNavVersion = questNavCmd?.description?.match(/v[\d.]+/)?.[0] || 
                                  questNavCmd?.apk_name?.match(/v[\d.]+/)?.[0] || 
                                  (questNavCmd ? 'unknown' : undefined);
          
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
            questnav_installed: installQuestNav,
            questnav_version: installQuestNav ? questNavVersion : undefined,
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
          questnav_installed: installQuestNav,
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <Logo />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
            <ThemeToggle />
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
            <div className="card" style={{ marginTop: '1.5rem' }}>
              <h2>QuestNav Setup Tool</h2>
              <p>This tool allows you to quickly configure your Meta Quest headset with optimized settings.</p>
              
              <div className="info-box" style={{ 
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderLeftColor: '#f59e0b'
              }}>
                <h3 style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  Developer Mode Required
                </h3>
                <p>
                  Before you begin, you must enable Developer Mode on your Meta Quest headset before using this tool. 
                  Visit the <a href="https://developers.meta.com/horizon/documentation/android-apps/enable-developer-mode" target="_blank" rel="noopener noreferrer">Meta Quest Developer Center</a> to create a developer account and enable Developer Mode in the Meta Quest mobile app.
                </p>
              </div>

              <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Getting started:</h3>
              <ol style={{ paddingLeft: '1.5rem', lineHeight: 1.8 }}>
                <li><a href="https://developers.meta.com/horizon/documentation/android-apps/enable-developer-mode" target="_blank" rel="noopener noreferrer">Enable Developer Mode</a> on your Quest headset</li>
                <li>Connect your Quest headset via USB cable to your device
                  <ul style={{ paddingLeft: '1.5rem', marginTop: '0.25rem', listStyle: 'none' }}>
                    <li>Supported devices: Windows · Linux · MacOS · Android</li>
                  </ul>
                </li>
                <li>Click the "Connect Quest" button to get started</li>
                <li>Select your Quest headset from the prompt window</li>
                <li>Allow your browser to access your Quest headset when prompted</li>
              </ol>
            </div>

            <div className="card" style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderLeft: '4px solid #ef4444',
              marginBottom: '2rem'
            }}>
              <h2 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                Unsupported Browser Detected
              </h2>
              <p style={{ marginTop: '1rem' }}>
                This tool requires a Chromium-based browser that supports WebUSB.
              </p>
              <p style={{ marginTop: '1rem' }}>
                For example, you can use:
              </p>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', lineHeight: 1.8 }}>
                <li>Google Chrome (version 112 or later)</li>
                <li>Microsoft Edge</li>
                <li>Brave</li>
                <li>Opera</li>
              </ul>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Confetti celebration on successful configuration */}
      {showConfetti && (
        <Confetti
          width={windowDimensions.width}
          height={windowDimensions.height}
          numberOfPieces={100}
          recycle={false}
          gravity={0.3}
          onConfettiComplete={(confetti) => {
            setShowConfetti(false);
            confetti?.reset();
          }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <Logo />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
          <ThemeToggle />
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
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h2>QuestNav Setup Tool</h2>
            <p>This tool allows you to quickly configure your Meta Quest headset with optimized settings.</p>
            
            <div className="info-box" style={{ 
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderLeftColor: '#f59e0b'
            }}>
              <h3 style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                Developer Mode Required
              </h3>
              <p>
                Before you begin, you must enable Developer Mode on your Meta Quest headset before using this tool. 
                Visit the <a href="https://developers.meta.com/horizon/documentation/android-apps/enable-developer-mode" target="_blank" rel="noopener noreferrer">Meta Quest Developer Center</a> to create a developer account and enable Developer Mode in the Meta Quest mobile app.
              </p>
            </div>

            <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Getting started:</h3>
            <ol style={{ paddingLeft: '1.5rem', lineHeight: 1.8 }}>
              <li><a href="https://developers.meta.com/horizon/documentation/android-apps/enable-developer-mode" target="_blank" rel="noopener noreferrer">Enable Developer Mode</a> on your Quest headset</li>
              <li>Connect your Quest headset via USB cable to your device
                <ul style={{ paddingLeft: '1.5rem', marginTop: '0.25rem', listStyle: 'none' }}>
                  <li>Supported devices: Windows · Linux · MacOS · Android</li>
                </ul>
              </li>
              <li>Click the "Connect Quest" button to get started</li>
              <li>Select your Quest headset from the prompt window</li>
              <li>Allow your browser to access your Quest headset when prompted</li>
            </ol>
          </div>

          <ConnectionStatus
            state={connectionState}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            disabled={isExecuting}
            isConnecting={isConnecting}
            onCancelConnection={handleCancelConnection}
            installQuestNav={installQuestNav}
            onInstallQuestNavChange={setInstallQuestNav}
            selectedApkHash={selectedApkHash}
            onSelectedApkHashChange={setSelectedApkHash}
            onApplyConfiguration={connectionState.connected && profile ? () => handleApplyConfiguration(profile, installQuestNav) : undefined}
            profile={profile}
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

          {(progress.status !== 'idle') && (
            <ProgressDisplay progress={progress} />
          )}
        </>
      )}
    </div>
  );
}

export default App;

