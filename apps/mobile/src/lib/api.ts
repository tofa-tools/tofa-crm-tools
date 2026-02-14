import axios, { AxiosError, AxiosInstance } from 'axios';
import type { LoginResponse, User, Lead } from '@tofa/core';
import { buildQueryParams, isTokenExpired } from '@tofa/core';
import { API_URL } from './config';
import * as storage from './storage';

// No trailing slash on baseURL (prevents 307 redirects)
const baseURL = API_URL.replace(/\/+$/, '');

const apiClient: AxiosInstance = axios.create({
  baseURL,
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

export const batchesAPI = {
  getMyBatches: async (): Promise<{ batches: Array<Record<string, unknown>>; count: number }> => {
    const { data } = await apiClient.get('/batches/my-batches');
    return data;
  },
};

export const leadsAPI = {
  getMyLeads: async (params?: { limit?: number; status?: string }): Promise<{ leads: Lead[]; total: number }> => {
    const { data } = await apiClient.get('/leads/my_leads', { params });
    return data;
  },
};

export const studentsAPI = {
  getStudents: async (params?: { center_id?: number; is_active?: boolean }): Promise<Array<Record<string, unknown>>> => {
    const { data } = await apiClient.get('/students', { params });
    return data;
  },
};

/** Attendance API - sends JSON body (lead_id or student_id required). */
export const attendanceAPI = {
  checkIn: async (data: {
    lead_id?: number;
    student_id?: number;
    batch_id: number;
    status: string;
    date?: string;
    remarks?: string;
  }): Promise<{ id: number; lead_id: number; batch_id: number; date: string; status: string }> => {
    const { data: result } = await apiClient.post('/attendance/check-in', data);
    return result;
  },
};

/** Staging API - sends JSON body for field capture. */
export const stagingAPI = {
  createStagingLead: async (data: {
    player_name: string;
    phone: string;
    email?: string;
    age?: number;
    center_id: number;
  }): Promise<unknown> => {
    const { data: result } = await apiClient.post('/staging/leads', data);
    return result;
  },
};

export default apiClient;
