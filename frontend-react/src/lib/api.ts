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
} from '@/types';
import { LeadSchema, UserSchema, AuditLogSchema, ImportPreviewResponseSchema } from '@/lib/schemas';
import { z } from 'zod';

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

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/me');
    return response.data;
  },
};

// Paginated Leads Response
const LeadsResponseSchema = z.object({
  leads: z.array(LeadSchema),
  total: z.number(),
  limit: z.number().nullable().optional(),
  offset: z.number(),
});

export type LeadsResponse = z.infer<typeof LeadsResponseSchema>;

// Leads API
export const leadsAPI = {
  getMyLeads: async (params?: { limit?: number; offset?: number; status?: string; search?: string; sort_by?: string; next_follow_up_date?: string; filter?: string; loss_reason?: string }): Promise<LeadsResponse> => {
    // sort_by can be: "created_time", "freshness", or "score"
    const response = await apiClient.get<LeadsResponse>('/leads/my_leads', { params });
    // Validate API response with Zod - use safeParse to handle validation errors gracefully
    const validationResult = LeadsResponseSchema.safeParse(response.data);
    if (!validationResult.success) {
      console.error('Leads response validation error:', validationResult.error);
      console.error('Response data:', response.data);
      // Return the data anyway if validation fails (for debugging)
      return response.data as LeadsResponse;
    }
    return validationResult.data;
  },

  updateLead: async (
    leadId: number,
    update: LeadUpdate
  ): Promise<{ status: string }> => {
    const params = new URLSearchParams();
    params.append('status', update.status);
    if (update.next_date) params.append('next_date', update.next_date);
    if (update.comment) params.append('comment', update.comment);
    if (update.trial_batch_id !== undefined) {
      params.append('trial_batch_id', String(update.trial_batch_id ?? ''));
    }
    if (update.permanent_batch_id !== undefined) {
      params.append('permanent_batch_id', String(update.permanent_batch_id ?? ''));
    }
    if (update.student_batch_ids) {
      params.append('student_batch_ids', update.student_batch_ids.join(','));
    }
    if (update.subscription_plan) params.append('subscription_plan', update.subscription_plan);
    if (update.subscription_start_date) params.append('subscription_start_date', update.subscription_start_date);
    if (update.subscription_end_date) params.append('subscription_end_date', update.subscription_end_date);

    const response = await apiClient.put(`/leads/${leadId}`, null, {
      params,
    });
    return response.data;
  },

  updateAgeCategory: async (
    leadId: number,
    ageCategory: string
  ): Promise<{ status: string; age_category: string }> => {
    const response = await apiClient.put(`/leads/${leadId}/age-category`, null, {
      params: { age_category: ageCategory },
    });
    return response.data;
  },

  previewLeads: async (file: File, columnMapping?: Record<string, string>): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (columnMapping) {
      formData.append('column_mapping', JSON.stringify(columnMapping));
    }

    const response = await apiClient.post('/leads/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  uploadLeads: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<UploadResponse>(
      '/leads/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  getLeadActivity: async (leadId: number, limit?: number): Promise<import('@/lib/schemas').AuditLog[]> => {
    const response = await apiClient.get(`/leads/${leadId}/activity`, {
      params: { limit },
    });
    // Validate API response with Zod
    const validatedData = z.array(AuditLogSchema).parse(response.data);
    return validatedData;
  },

  logReportSent: async (leadId: number, message?: string): Promise<{ status: string; message: string }> => {
    const params = new URLSearchParams();
    if (message) {
      params.append('message', message);
    }
    const response = await apiClient.post(`/leads/${leadId}/report-sent`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  bulkUpdateStatus: async (leadIds: number[], newStatus: string): Promise<{ updated_count: number; errors: string[] }> => {
    const response = await apiClient.post('/leads/bulk/status', {
      lead_ids: leadIds,
      new_status: newStatus,
    });
    return response.data;
  },

  bulkAssignCenter: async (leadIds: number[], centerId: number): Promise<{ updated_count: number; errors: string[] }> => {
    const response = await apiClient.post('/leads/bulk/assign', {
      lead_ids: leadIds,
      center_id: centerId,
    });
    return response.data;
  },

  previewLeadsUpload: async (file: File, columnMapping?: Record<string, string>): Promise<ImportPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (columnMapping) {
      formData.append('column_mapping', JSON.stringify(columnMapping));
    }
    const response = await apiClient.post<ImportPreviewResponse>(
      '/leads/preview',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return ImportPreviewResponseSchema.parse(response.data);
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

// Analytics API
export const analyticsAPI = {
  getCommandCenter: async (targetDate?: string): Promise<any> => {
    const params = targetDate ? { target_date: targetDate } : {};
    const response = await apiClient.get('/analytics/command-center', { params });
    return response.data;
  },
  getConversionRates: async (): Promise<{ conversion_rates: Record<string, number> }> => {
    const response = await apiClient.get<{ conversion_rates: Record<string, number> }>('/analytics/conversion-rates');
    return response.data;
  },

  getTimeToContact: async (): Promise<{ average_hours: number | null }> => {
    const response = await apiClient.get<{ average_hours: number | null }>('/analytics/time-to-contact');
    return response.data;
  },

  getStatusDistribution: async (): Promise<{ distribution: Record<string, number> }> => {
    const response = await apiClient.get<{ distribution: Record<string, number> }>('/analytics/status-distribution');
    return response.data;
  },

  getAbandonedCount: async (): Promise<{ abandoned_leads_count: number }> => {
    const response = await apiClient.get<{ abandoned_leads_count: number }>('/analytics/abandoned-count');
    return response.data;
  },

  getAtRiskCount: async (): Promise<{ at_risk_leads_count: number }> => {
    const response = await apiClient.get<{ at_risk_leads_count: number }>('/analytics/at-risk-count');
    return response.data;
  },

  getPendingStudentReports: async (): Promise<{
    pending_students: Array<{
      lead_id: number;
      player_name: string;
      center_id: number | null;
      center_name: string | null;
      batch_id: number | null;
      batch_name: string | null;
      last_evaluation_date: string;
      total_evaluations: number;
    }>;
    count: number;
  }> => {
    const response = await apiClient.get<{
      pending_students: Array<{
        lead_id: number;
        player_name: string;
        center_id: number | null;
        center_name: string | null;
        batch_id: number | null;
        batch_name: string | null;
        last_evaluation_date: string;
        total_evaluations: number;
      }>;
      count: number;
    }>('/analytics/pending-student-reports');
    return response.data;
  },
};

// Staging API
export const stagingAPI = {
  createStagingLead: async (data: {
    player_name: string;
    phone: string;
    center_id: number;
    date_of_birth?: string;
  }): Promise<any> => {
    const params = new URLSearchParams();
    params.append('player_name', data.player_name);
    params.append('phone', data.phone);
    params.append('center_id', String(data.center_id));
    if (data.date_of_birth) {
      params.append('date_of_birth', data.date_of_birth);
    }
    const response = await apiClient.post('/leads/staging', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  getStagingLeads: async (center_id?: number): Promise<any[]> => {
    const params = center_id ? { center_id } : {};
    const response = await apiClient.get('/leads/staging', { params });
    return response.data;
  },

  promoteStagingLead: async (
    stagingId: number,
    data: {
      email?: string;
      address?: string;
      player_age_category?: string;
    }
  ): Promise<Lead> => {
    const params = new URLSearchParams();
    if (data.email) params.append('email', data.email);
    if (data.address) params.append('address', data.address);
    if (data.player_age_category) params.append('player_age_category', data.player_age_category);
    
    const response = await apiClient.post(
      `/leads/staging/${stagingId}/promote`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
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
    const params = new URLSearchParams();
    params.append('technical_score', String(data.technical_score));
    params.append('fitness_score', String(data.fitness_score));
    params.append('teamwork_score', String(data.teamwork_score));
    params.append('discipline_score', String(data.discipline_score));
    if (data.coach_notes) {
      params.append('coach_notes', data.coach_notes);
    }
    
    const response = await apiClient.post(`/leads/${leadId}/skills`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  getSkillSummary: async (leadId: number): Promise<{
    average_technical_score: number | null;
    average_fitness_score: number | null;
    average_teamwork_score: number | null;
    average_discipline_score: number | null;
    total_evaluations: number;
    most_recent_notes: string | null;
    most_recent_evaluation_date: string | null;
  }> => {
    const response = await apiClient.get(`/leads/${leadId}/skills/summary`);
    return response.data;
  },
};

// Tasks & Calendar API
export const tasksAPI = {
  getDailyQueue: async (targetDate?: string): Promise<{
    overdue: Lead[];
    due_today: Lead[];
    upcoming: Lead[];
  }> => {
    const params = targetDate ? { target_date: targetDate } : {};
    const response = await apiClient.get('/tasks/daily-queue', { params });
    return response.data;
  },

  getDailyStats: async (targetDate?: string): Promise<{
    total_tasks: number;
    high_priority: number;
    overdue_count: number;
    due_today_count: number;
  }> => {
    const params = targetDate ? { target_date: targetDate } : {};
    const response = await apiClient.get('/tasks/daily-stats', { params });
    return response.data;
  },
};

export const calendarAPI = {
  getMonthView: async (year: number, month: number, centerIds?: number[]): Promise<Record<string, {
    total: number;
    high_priority: number;
    trials: number;
    calls: number;
  }>> => {
    const params: any = { year, month };
    if (centerIds && centerIds.length > 0) {
      params.center_ids = centerIds.join(',');
    }
    const response = await apiClient.get('/calendar/month', { params });
    return response.data;
  },
};

// User Stats API (for gamification)
export const userStatsAPI = {
  getStreak: async (): Promise<{
    current_streak: number;
    longest_streak: number;
    total_completion_days: number;
  }> => {
    const response = await apiClient.get('/user/stats/streak');
    return response.data;
  },

  getTodayStats: async (targetDate?: string): Promise<{
    tasks_completed: number;
    comments_added: number;
    leads_updated: number;
  }> => {
    const params = targetDate ? { target_date: targetDate } : {};
    const response = await apiClient.get('/user/stats/today', { params });
    return response.data;
  },
};

// Batches API
export const batchesAPI = {
  getBatches: async (params?: { center_id?: number }): Promise<Batch[]> => {
    const response = await apiClient.get<Batch[]>('/batches', { params });
    return response.data;
  },

  createBatch: async (data: BatchCreate): Promise<{ status: string; batch: Batch }> => {
    // Backend expects query parameters, not JSON body
    const params = new URLSearchParams();
    params.append('name', data.name);
    params.append('center_id', String(data.center_id));
    params.append('age_category', data.age_category);
    params.append('max_capacity', String(data.max_capacity));
    params.append('is_mon', String(data.is_mon));
    params.append('is_tue', String(data.is_tue));
    params.append('is_wed', String(data.is_wed));
    params.append('is_thu', String(data.is_thu));
    params.append('is_fri', String(data.is_fri));
    params.append('is_sat', String(data.is_sat));
    params.append('is_sun', String(data.is_sun));
    params.append('start_date', data.start_date);
    params.append('is_active', String(data.is_active !== undefined ? data.is_active : true));
    if (data.start_time) params.append('start_time', data.start_time);
    if (data.end_time) params.append('end_time', data.end_time);
    // Add coach_ids as comma-separated string
    if (data.coach_ids && data.coach_ids.length > 0) {
      params.append('coach_ids', data.coach_ids.join(','));
    }

    const response = await apiClient.post<{ status: string; batch: Batch }>('/batches', null, {
      params,
    });
    return response.data;
  },

  assignCoach: async (batchId: number, coachIds: number[]): Promise<{ status: string; batch_id: number; coach_ids?: number[]; user_id?: number }> => {
    const params = new URLSearchParams();
    // Use coach_ids for multiple assignment (replaces all existing)
    if (coachIds.length > 0) {
      params.append('coach_ids', coachIds.join(','));
    }

    const response = await apiClient.post<{ status: string; batch_id: number; coach_ids?: number[]; user_id?: number }>(
      `/batches/${batchId}/assign-coach`,
      null,
      { params }
    );
    return response.data;
  },

  updateBatch: async (batchId: number, data: Partial<BatchCreate>): Promise<{ status: string; batch: Batch }> => {
    const params = new URLSearchParams();
    if (data.name !== undefined) params.append('name', data.name);
    if (data.center_id !== undefined) params.append('center_id', String(data.center_id));
    if (data.age_category !== undefined) params.append('age_category', data.age_category);
    if (data.max_capacity !== undefined) params.append('max_capacity', String(data.max_capacity));
    if (data.is_mon !== undefined) params.append('is_mon', String(data.is_mon));
    if (data.is_tue !== undefined) params.append('is_tue', String(data.is_tue));
    if (data.is_wed !== undefined) params.append('is_wed', String(data.is_wed));
    if (data.is_thu !== undefined) params.append('is_thu', String(data.is_thu));
    if (data.is_fri !== undefined) params.append('is_fri', String(data.is_fri));
    if (data.is_sat !== undefined) params.append('is_sat', String(data.is_sat));
    if (data.is_sun !== undefined) params.append('is_sun', String(data.is_sun));
    if (data.start_date !== undefined) params.append('start_date', data.start_date);
    if (data.is_active !== undefined) params.append('is_active', String(data.is_active));
    if (data.start_time !== undefined) params.append('start_time', data.start_time || '');
    if (data.end_time !== undefined) params.append('end_time', data.end_time || '');
    if (data.coach_ids !== undefined && data.coach_ids.length > 0) {
      params.append('coach_ids', data.coach_ids.join(','));
    }

    const response = await apiClient.put<{ status: string; batch: Batch }>(`/batches/${batchId}`, null, {
      params,
    });
    return response.data;
  },

  deleteBatch: async (batchId: number): Promise<{ status: string; batch_id: number }> => {
    const response = await apiClient.delete<{ status: string; batch_id: number }>(`/batches/${batchId}`);
    return response.data;
  },

  getMyBatches: async (): Promise<{ batches: Batch[]; count: number }> => {
    const response = await apiClient.get<{ batches: Batch[]; count: number }>('/batches/my-batches');
    return response.data;
  },
};

// Attendance API
export const attendanceAPI = {
  checkIn: async (data: {
    lead_id: number;
    batch_id: number;
    status: string;
    date?: string;
    remarks?: string;
  }): Promise<{
    status: string;
    attendance_id: number;
    lead_id: number;
    batch_id: number;
    date: string;
    status: string;
  }> => {
    const params = new URLSearchParams();
    params.append('lead_id', String(data.lead_id));
    params.append('batch_id', String(data.batch_id));
    params.append('status', data.status);
    if (data.date) params.append('date', data.date);
    if (data.remarks) params.append('remarks', data.remarks);

    const response = await apiClient.post<{
      status: string;
      attendance_id: number;
      lead_id: number;
      batch_id: number;
      date: string;
      status: string;
    }>('/attendance/check-in', null, { params });
    return response.data;
  },

  getHistory: async (leadId: number): Promise<{
    lead_id: number;
    attendance: Array<{
      id: number;
      batch_id: number;
      date: string;
      status: string;
      remarks: string | null;
      recorded_at: string | null;
      coach_id: number;
    }>;
    count: number;
  }> => {
    const response = await apiClient.get<{
      lead_id: number;
      attendance: Array<{
        id: number;
        batch_id: number;
        date: string;
        status: string;
        remarks: string | null;
        recorded_at: string | null;
        coach_id: number;
      }>;
      count: number;
    }>(`/attendance/history/${leadId}`);
    return response.data;
  },
};

export default apiClient;

