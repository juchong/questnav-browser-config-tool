import { AuthResponse, LoginCredentials } from '../types';

const API_BASE = '/api/auth';

export const authService = {
  /**
   * Login with username and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important for cookies
        body: JSON.stringify(credentials)
      });
      
      const data: AuthResponse = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  /**
   * Logout current session
   */
  async logout(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      
      const data: AuthResponse = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  },

  /**
   * Check if user is authenticated
   */
  async checkAuth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/status`, {
        credentials: 'include'
      });
      
      const data: AuthResponse = await response.json();
      return data.success;
    } catch (error) {
      return false;
    }
  }
};

