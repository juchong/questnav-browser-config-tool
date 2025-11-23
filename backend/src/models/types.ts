export interface AdbCommand {
  command: string;
  description: string;
  category: 'refresh_rate' | 'performance' | 'display' | 'privacy' | 'system';
}

export interface ConfigProfile {
  id?: number;
  name: string;
  description: string;
  commands: AdbCommand[];
  created_at?: string;
  updated_at?: string;
}

export interface ExecutionLog {
  id?: number;
  profile_id: number;
  status: 'success' | 'failure' | 'partial';
  error_message?: string;
  executed_at?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

