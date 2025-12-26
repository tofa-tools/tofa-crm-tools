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
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
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
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Handle unauthorized - redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    // Use URLSearchParams for application/x-www-form-urlencoded (required by OAuth2PasswordRequestForm)
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);

    const response = await apiClient.post<LoginResponse>('/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },
};

// Leads API
export const leadsAPI = {
  getMyLeads: async (): Promise<Lead[]> => {
    const response = await apiClient.get<Lead[]>('/leads/my_leads');
    return response.data;
  },

  updateLead: async (
    leadId: number,
    update: LeadUpdate
  ): Promise<{ status: string }> => {
    const params = new URLSearchParams();
    params.append('status', update.status);
    if (update.next_date) params.append('next_date', update.next_date);
    if (update.comment) params.append('comment', update.comment);

    const response = await apiClient.put(`/leads/${leadId}`, null, {
      params,
    });
    return response.data;
  },

  uploadLeads: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<UploadResponse>(
      '/leads/upload/',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },
};

// Users API
export const usersAPI = {
  getUsers: async (): Promise<User[]> => {
    const response = await apiClient.get<User[]>('/users/');
    return response.data;
  },

  createUser: async (userData: UserCreate): Promise<{ status: string }> => {
    const response = await apiClient.post('/users/', userData);
    return response.data;
  },
};

// Centers API
export const centersAPI = {
  getCenters: async (): Promise<Center[]> => {
    const response = await apiClient.get<Center[]>('/centers/');
    return response.data;
  },

  createCenter: async (centerData: CenterCreate): Promise<Center> => {
    const response = await apiClient.post<Center>('/centers/', centerData);
    return response.data;
  },
};

export default apiClient;

