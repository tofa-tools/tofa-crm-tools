/**
 * API Client for React Native Mobile App
 * Uses ReactNativeTokenStorage and ReactNativeNavigationHandler
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  User,
  UserCreate,
  Center,
  CenterCreate,
  Lead,
  LeadUpdate,
  LoginResponse,
  UploadResponse,
  ImportPreviewResponse,
  Batch,
  BatchCreate,
  Attendance,
  AttendanceCreate,
} from '@tofa/core';
import { LeadSchema, UserSchema, AuditLogSchema, ImportPreviewResponseSchema, buildQueryParams, isTokenExpired } from '@tofa/core';
import { z } from 'zod';
import { ReactNativeTokenStorage } from '../storage/ReactNativeTokenStorage';
import { ReactNativeNavigationHandler } from '../navigation/ReactNativeNavigationHandler';
import { StandardErrorHandler } from './ErrorHandler';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// Create platform-specific instances
const tokenStorage = new ReactNativeTokenStorage();
const navigationHandler = new ReactNativeNavigationHandler();
const errorHandler = new StandardErrorHandler(navigationHandler);

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      const token = await tokenStorage.getToken();
      if (token) {
        if (isTokenExpired(token)) {
          console.log('Token expired, logging out');
        } else {
          console.log('Unauthorized (401) - token may be invalid');
        }
        // Handle 401 error using error handler
        await errorHandler.handle401(error, tokenStorage);
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const params = buildQueryParams({
      username: email,
      password: password,
    });
    
    const response = await apiClient.post<LoginResponse>('/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/me');
    const validated = UserSchema.parse(response.data);
    return validated;
  },
};

// Leads API
export const leadsAPI = {
  getMyLeads: async (params?: {
    limit?: number;
    offset?: number;
    status?: string;
    search?: string;
    sort_by?: string;
    next_follow_up_date?: string;
    filter?: string;
    loss_reason?: string;
  }): Promise<{ leads: Lead[]; total: number }> => {
    const response = await apiClient.get('/leads/my_leads', { params });
    const validated = LeadSchema.array().parse(response.data.leads);
    return {
      leads: validated,
      total: response.data.total,
    };
  },
};

// Batches API
export const batchesAPI = {
  getBatches: async (params?: { center_id?: number }): Promise<{ batches: Batch[] }> => {
    const response = await apiClient.get('/batches', { params });
    return response.data;
  },
  
  getCoachBatches: async (): Promise<{ batches: Batch[] }> => {
    const response = await apiClient.get('/batches/coach');
    return response.data;
  },
};

// Centers API
export const centersAPI = {
  getCenters: async (): Promise<{ centers: Center[] }> => {
    const response = await apiClient.get('/centers');
    return response.data;
  },
};

// Students API
export const studentsAPI = {
  getStudents: async (params?: { is_active?: boolean; center_id?: number }): Promise<any[]> => {
    const response = await apiClient.get('/students', { params });
    return response.data;
  },
  
  getMilestones: async (studentId: number): Promise<any> => {
    const response = await apiClient.get(`/students/${studentId}/milestones`);
    return response.data;
  },
};

// Staging API
export const stagingAPI = {
  createStagingLead: async (data: {
    player_name: string;
    phone: string;
    email?: string;
    center_id: number;
  }): Promise<any> => {
    const response = await apiClient.post('/staging/leads', data);
    return response.data;
  },
  
  getStagingLeads: async (): Promise<any[]> => {
    const response = await apiClient.get('/staging/leads');
    return response.data;
  },
};

// Attendance API
export const attendanceAPI = {
  checkIn: async (data: AttendanceCreate): Promise<any> => {
    const params = buildQueryParams({
      lead_id: data.lead_id,
      student_id: data.student_id,
      batch_id: data.batch_id,
      status: data.status,
      date: data.date,
      remarks: data.remarks,
    });
    
    const response = await apiClient.post('/attendance/check-in', null, { params });
    return response.data;
  },
  
  getHistory: async (leadId: number): Promise<{
    lead_id: number;
    attendance: Array<{
      id: number;
      batch_id: number;
      date: string;
      status: string;
    }>;
  }> => {
    const response = await apiClient.get(`/attendance/history/${leadId}`);
    return response.data;
  },
};

// Skills API
export const skillsAPI = {
  createEvaluation: async (
    leadId: number,
    data: {
      technical_score: number;
      fitness_score: number;
      teamwork_score: number;
      discipline_score: number;
      coach_notes?: string;
    }
  ): Promise<any> => {
    const params = buildQueryParams({
      technical_score: data.technical_score,
      fitness_score: data.fitness_score,
      teamwork_score: data.teamwork_score,
      discipline_score: data.discipline_score,
      coach_notes: data.coach_notes,
    });
    
    const response = await apiClient.post(`/leads/${leadId}/skills`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },
};

// Export token storage and navigation handler for use in components
export { tokenStorage, navigationHandler };

