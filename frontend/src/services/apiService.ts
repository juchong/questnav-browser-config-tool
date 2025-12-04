import { ConfigProfile, ApiResponse, ExecutionLog } from '../types';

const API_BASE = '/api';

export const api = {
  // Profile endpoints
  async getProfiles(): Promise<ConfigProfile[]> {
    const response = await fetch(`${API_BASE}/profiles`);
    const data: ApiResponse<ConfigProfile[]> = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch profiles');
    return data.data!;
  },

  async getProfile(id: number): Promise<ConfigProfile> {
    const response = await fetch(`${API_BASE}/profiles/${id}`);
    const data: ApiResponse<ConfigProfile> = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch profile');
    return data.data!;
  },

  // Admin endpoints
  async getAllProfiles(): Promise<ConfigProfile[]> {
    const response = await fetch(`${API_BASE}/admin/profiles`);
    const data: ApiResponse<ConfigProfile[]> = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch all profiles');
    return data.data!;
  },

  async setActiveProfile(id: number): Promise<ConfigProfile> {
    const response = await fetch(`${API_BASE}/admin/profiles/${id}/activate`, {
      method: 'PUT'
    });
    const data: ApiResponse<ConfigProfile> = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to set active profile');
    return data.data!;
  },

  async createProfile(profile: ConfigProfile): Promise<ConfigProfile> {
    const response = await fetch(`${API_BASE}/admin/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    const data: ApiResponse<ConfigProfile> = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to create profile');
    return data.data!;
  },

  async updateProfile(id: number, profile: Partial<ConfigProfile>): Promise<ConfigProfile> {
    const response = await fetch(`${API_BASE}/admin/profiles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    const data: ApiResponse<ConfigProfile> = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to update profile');
    return data.data!;
  },

  async deleteProfile(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/admin/profiles/${id}`, {
      method: 'DELETE'
    });
    const data: ApiResponse = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete profile');
  },

  // Logging endpoints
  async logExecution(log: ExecutionLog): Promise<void> {
    const response = await fetch(`${API_BASE}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    });
    const data: ApiResponse = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to log execution');
  },

  async getLogs(limit?: number): Promise<ExecutionLog[]> {
    const url = limit ? `${API_BASE}/logs/admin?limit=${limit}` : `${API_BASE}/logs/admin`;
    const response = await fetch(url);
    const data: ApiResponse<ExecutionLog[]> = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch logs');
    return data.data!;
  },

  async getStats(): Promise<any> {
    const response = await fetch(`${API_BASE}/logs/admin/stats`);
    const data: ApiResponse = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch stats');
    return data.data;
  },

  async getExtendedStats(days: number = 30): Promise<ExtendedStats> {
    const response = await fetch(`${API_BASE}/logs/admin/stats/extended?days=${days}`);
    const data: ApiResponse<ExtendedStats> = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch extended stats');
    return data.data!;
  },

  // Ignored serials management
  async getIgnoredSerials(): Promise<IgnoredSerial[]> {
    const response = await fetch(`${API_BASE}/admin/ignored-serials`);
    const data: ApiResponse<IgnoredSerial[]> = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch ignored serials');
    return data.data!;
  },

  async getAvailableSerials(): Promise<AvailableSerial[]> {
    const response = await fetch(`${API_BASE}/admin/ignored-serials/available`);
    const data: ApiResponse<AvailableSerial[]> = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to fetch available serials');
    return data.data!;
  },

  async addIgnoredSerial(serial: string, label?: string): Promise<IgnoredSerial> {
    const response = await fetch(`${API_BASE}/admin/ignored-serials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial, label })
    });
    const data: ApiResponse<IgnoredSerial> = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to add ignored serial');
    return data.data!;
  },

  async removeIgnoredSerial(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/admin/ignored-serials/${id}`, {
      method: 'DELETE'
    });
    const data: ApiResponse = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to remove ignored serial');
  }
};

// Ignored serial types
export interface IgnoredSerial {
  id: number;
  serial: string;
  label?: string;
  created_at: string;
}

export interface AvailableSerial {
  serial: string;
  device_name: string;
  execution_count: number;
}

// Extended stats type for visualizations
export interface ExtendedStats {
  period: {
    days: number;
    total: number;
    success: number;
    failure: number;
    partial: number;
    successRate: number;
  };
  allTime: {
    total: number;
    success: number;
    successRate: number;
  };
  daily: Array<{
    date: string;
    total: number;
    success: number;
    failure: number;
  }>;
  browsers: Array<{
    browser: string;
    count: number;
  }>;
  operatingSystems: Array<{
    os: string;
    count: number;
  }>;
  devices: {
    uniqueCount: number;
  };
  duration: {
    avgMs: number | null;
    minMs: number | null;
    maxMs: number | null;
  };
  recentExecutions: Array<{
    id: number;
    status: string;
    device_name: string | null;
    device_serial: string | null;
    browser_name: string | null;
    os_name: string | null;
    executed_at: string;
    execution_duration_ms: number | null;
    total_commands: number | null;
    successful_commands: number | null;
    failed_commands: number | null;
    questnav_installed: boolean;
    questnav_version: string | null;
    failed_command_details: Array<{
      description: string;
      error: string;
    }>;
    client_ip: string | null;
  }>;
}

