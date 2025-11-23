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
  }
};

