export interface AdbCommand {
  command: string;
  description: string;
  category: 'refresh_rate' | 'performance' | 'display' | 'privacy' | 'system' | 'diagnostic' | 'app_install';
  is_hidden?: boolean;   // Hide this command from user-facing lists
  requires_questnav?: 'with' | 'without';  // Conditional execution based on QuestNav install choice
  // 'with' = only run if user chose to install QuestNav
  // 'without' = only run if user opted OUT of QuestNav
  // undefined = always run
  // Additional fields for app_install category
  apk_url?: string;      // Original URL (for reference/re-download)
  apk_name?: string;     // Friendly name of the APK (for app_install commands)
  apk_hash?: string;     // SHA256 hash of downloaded APK (for verification and serving)
}

export interface ConfigProfile {
  id?: number;
  name: string;
  description: string;
  commands: AdbCommand[];
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BrowserInfo {
  browser_name?: string;
  browser_version?: string;
  browser_engine?: string;
  os_name?: string;
  os_version?: string;
  platform?: string;
  screen_resolution?: string;
  viewport_size?: string;
  timezone?: string;
  language?: string;
  webusb_supported?: boolean;
  browser_fingerprint?: string;
}

export interface CommandExecutionResult {
  command: string;
  description: string;
  category: string;
  success: boolean;
  output?: string;
  error?: string;
  timestamp: string;
  duration_ms: number;
  // Parsed diagnostic data (for dumpsys tracking and similar)
  parsed_data?: {
    sections?: Array<{
      name: string;
      content: string;
      lineStart: number;
      lineEnd: number;
    }>;
    metadata?: Record<string, any>;
    key_stats?: Record<string, any>;
  };
}

export interface ExecutionLog extends BrowserInfo {
  id?: number;
  profile_id: number;
  status: 'success' | 'failure' | 'partial';
  error_message?: string;
  executed_at?: string;
  
  // Enhanced metadata
  client_ip?: string;
  user_agent?: string;
  device_serial?: string;
  device_name?: string;
  connection_timestamp?: string;
  execution_start_timestamp?: string;
  execution_end_timestamp?: string;
  execution_duration_ms?: number;
  command_results?: CommandExecutionResult[]; // Will be stored as JSON in DB
  total_commands?: number;
  successful_commands?: number;
  failed_commands?: number;
  
  // QuestNav installation tracking
  questnav_installed?: boolean;
  questnav_version?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AdminUser {
  id?: number;
  username: string;
  password_hash: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface CustomJwtPayload {
  userId: number;
  username: string;
}

