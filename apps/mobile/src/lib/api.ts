import axios, { AxiosError, AxiosInstance } from 'axios';
import type { LoginResponse, User, Lead } from '@tofa/core';
import { buildQueryParams, isTokenExpired } from '@tofa/core';
import { API_URL } from './config';
import * as storage from './storage';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await storage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

apiClient.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    if (err.response?.status === 401) {
      const token = await storage.getToken();
      if (token && isTokenExpired(token)) {
        await storage.clear();
        // Navigation to login is handled by AuthContext when user becomes null
      }
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const params = buildQueryParams({ username: email, password });
    const { data } = await apiClient.post<LoginResponse>('/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data;
  },

  getCurrentUser: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/me');
    return data;
  },
};

export const analyticsAPI = {
  getCommandCenter: async (targetDate?: string): Promise<Record<string, unknown>> => {
    const params = targetDate ? { target_date: targetDate } : {};
    const { data } = await apiClient.get('/analytics/command-center', { params });
    return data;
  },
};

export const tasksAPI = {
  getDailyQueue: async (targetDate?: string): Promise<{
    overdue: Lead[];
    due_today: Lead[];
    upcoming: Lead[];
  }> => {
    const params = targetDate ? { target_date: targetDate } : {};
    const { data } = await apiClient.get('/tasks/daily-queue', { params });
    return data;
  },
};

export default apiClient;
