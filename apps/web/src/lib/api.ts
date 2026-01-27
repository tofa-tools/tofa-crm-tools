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
import { LeadSchema, UserSchema, AuditLogSchema, ImportPreviewResponseSchema, buildQueryParams, isTokenExpired, generateUniqueFileName } from '@tofa/core';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { createTokenStorage } from '@/lib/storage';
import { createNavigationHandler } from '@/lib/navigation';
import { StandardErrorHandler } from '@/lib/api/ErrorHandler';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// Create platform-specific instances
const tokenStorage = createTokenStorage();
const navigationHandler = createNavigationHandler();
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
    // Use URLSearchParams for application/x-www-form-urlencoded (required by OAuth2PasswordRequestForm)
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
    // sort_by can be: "created_time" or "freshness"
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
    const params = buildQueryParams({
      status: update.status,
      next_date: update.next_date,
      comment: update.comment,
      trial_batch_id: update.trial_batch_id,
      permanent_batch_id: update.permanent_batch_id,
      student_batch_ids: update.student_batch_ids,
      subscription_plan: update.subscription_plan,
      subscription_start_date: update.subscription_start_date,
      subscription_end_date: update.subscription_end_date,
      payment_proof_url: update.payment_proof_url,
      call_confirmation_note: update.call_confirmation_note,
    });

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

  createLead: async (data: {
    player_name: string;
    player_age_category: string;
    phone: string;
    email?: string;
    address?: string;
    center_id: number;
    status: string;
  }): Promise<Lead> => {
    const response = await apiClient.post('/leads', data);
    return response.data;
  },

  logReportSent: async (leadId: number, message?: string): Promise<{ status: string; message: string }> => {
    const params = buildQueryParams({
      message: message,
    });
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

  sendNudge: async (leadId: number): Promise<{ message: string; nudge_count: number }> => {
    const response = await apiClient.post<{ message: string; nudge_count: number }>(`/leads/${leadId}/nudge`);
    return response.data;
  },

  convertLead: async (
    leadId: number,
    data: {
      subscription_plan: string;
      subscription_start_date: string;
      subscription_end_date?: string;
      payment_proof_url?: string;
      student_batch_ids?: number[];
    }
  ): Promise<any> => {
    const params = buildQueryParams({
      subscription_plan: data.subscription_plan,
      subscription_start_date: data.subscription_start_date,
      subscription_end_date: data.subscription_end_date,
      payment_proof_url: data.payment_proof_url,
      student_batch_ids: data.student_batch_ids,
    });

    const response = await apiClient.post(`/leads/${leadId}/convert`, null, {
      params,
    });
    return response.data;
  },
};

// Students API
export const studentsAPI = {
  getStudents: async (params?: {
    center_id?: number;
    is_active?: boolean;
  }): Promise<any[]> => {
    const response = await apiClient.get<any[]>('/students', { params });
    return response.data;
  },

  updateStudent: async (
    studentId: number,
    data: {
      center_id?: number;
      subscription_plan?: string;
      subscription_start_date?: string;
      subscription_end_date?: string;
      payment_proof_url?: string;
      student_batch_ids?: number[];
      is_active?: boolean;
    }
  ): Promise<any> => {
    const params = buildQueryParams({
      center_id: data.center_id,
      subscription_plan: data.subscription_plan,
      subscription_start_date: data.subscription_start_date,
      subscription_end_date: data.subscription_end_date,
      payment_proof_url: data.payment_proof_url,
      is_active: data.is_active,
      student_batch_ids: data.student_batch_ids,
    });

    const response = await apiClient.put(`/students/${studentId}`, null, {
      params,
    });
    return response.data;
  },

  sendGraceNudge: async (studentId: number): Promise<{ message: string; grace_nudge_count: number }> => {
    const response = await apiClient.post<{ message: string; grace_nudge_count: number }>(`/students/${studentId}/grace-nudge`);
    return response.data;
  },

  recordRenewalIntent: async (token: string): Promise<{ message: string }> => {
    const response = await apiClient.put<{ message: string }>(`/students/renew/${token}`);
    return response.data;
  },

  getMilestones: async (studentId: number): Promise<{
    total_present: number;
    current_milestone: number | null;
    next_milestone: number | null;
    sessions_until_next: number | null;
  }> => {
    const response = await apiClient.get<{
      total_present: number;
      current_milestone: number | null;
      next_milestone: number | null;
      sessions_until_next: number | null;
    }>(`/students/${studentId}/milestones`);
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

  updateUser: async (userId: number, userData: Partial<UserCreate>): Promise<User> => {
    const response = await apiClient.put<User>(`/users/${userId}`, userData);
    return response.data;
  },

  toggleUserStatus: async (userId: number): Promise<User> => {
    const response = await apiClient.put<User>(`/users/${userId}/toggle-status`);
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

  updateCenter: async (centerId: number, centerData: Partial<CenterCreate>): Promise<Center> => {
    const response = await apiClient.put<Center>(`/centers/${centerId}`, centerData);
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
    email?: string;
    center_id: number;
  }): Promise<any> => {
    const response = await apiClient.post('/staging/leads', data);
    return response.data;
  },

  getStagingLeads: async (center_id?: number): Promise<any[]> => {
    const params = center_id ? { center_id } : {};
    const response = await apiClient.get('/staging/leads', { params });
    return response.data;
  },

  promoteStagingLead: async (
    stagingId: number,
    data: {
      player_age_category: string;
      email?: string;
      address?: string;
    }
  ): Promise<Lead> => {
    const response = await apiClient.post(`/staging/leads/${stagingId}/promote`, data);
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
    const params = buildQueryParams({
      year,
      month,
      center_ids: centerIds,
    });
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
    const params = buildQueryParams({
      name: data.name,
      center_id: data.center_id,
      age_category: data.age_category,
      max_capacity: data.max_capacity,
      is_mon: data.is_mon,
      is_tue: data.is_tue,
      is_wed: data.is_wed,
      is_thu: data.is_thu,
      is_fri: data.is_fri,
      is_sat: data.is_sat,
      is_sun: data.is_sun,
      start_date: data.start_date,
      is_active: data.is_active !== undefined ? data.is_active : true,
      start_time: data.start_time,
      end_time: data.end_time,
      coach_ids: data.coach_ids,
    });

    const response = await apiClient.post<{ status: string; batch: Batch }>('/batches', null, {
      params,
    });
    return response.data;
  },

  assignCoach: async (batchId: number, coachIds: number[]): Promise<{ status: string; batch_id: number; coach_ids?: number[]; user_id?: number }> => {
    const params = buildQueryParams({
      coach_ids: coachIds.length > 0 ? coachIds : undefined,
    });

    const response = await apiClient.post<{ status: string; batch_id: number; coach_ids?: number[]; user_id?: number }>(
      `/batches/${batchId}/assign-coach`,
      null,
      { params }
    );
    return response.data;
  },

  updateBatch: async (batchId: number, data: Partial<BatchCreate>): Promise<{ status: string; batch: Batch }> => {
    const params = buildQueryParams({
      name: data.name,
      center_id: data.center_id,
      age_category: data.age_category,
      max_capacity: data.max_capacity,
      is_mon: data.is_mon,
      is_tue: data.is_tue,
      is_wed: data.is_wed,
      is_thu: data.is_thu,
      is_fri: data.is_fri,
      is_sat: data.is_sat,
      is_sun: data.is_sun,
      start_date: data.start_date,
      is_active: data.is_active,
      start_time: data.start_time,
      end_time: data.end_time,
      coach_ids: data.coach_ids,
    });

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
    lead_id?: number;
    student_id?: number;
    batch_id: number;
    status: string;
    date?: string;
    remarks?: string;
  }): Promise<{
    status: string;
    attendance_id: number;
    lead_id?: number;
    student_id?: number;
    batch_id: number;
    date: string;
    status: string;
  }> => {
    const params = buildQueryParams({
      lead_id: data.lead_id,
      student_id: data.student_id,
      batch_id: data.batch_id,
      status: data.status,
      date: data.date,
      remarks: data.remarks,
    });

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

// Subscriptions API
export const subscriptionsAPI = {
  runExpiryCheck: async (): Promise<{ expired_count: number }> => {
    const response = await apiClient.post<{ expired_count: number }>('/subscriptions/run-expiry-check');
    return response.data;
  },
};

// File Upload API (Supabase Storage)
export const uploadFile = async (file: File, bucketName: string = 'payment-proofs'): Promise<string> => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
  }

  try {
    // Generate a unique filename
    const fileName = generateUniqueFileName(file.name);
    const filePath = `${fileName}`;

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Approvals API
export const approvalsAPI = {
  createRequest: async (data: {
    lead_id: number;
    current_status: string;
    requested_status: string;
    reason: string;
  }): Promise<{ status: string; message: string; request_id: number }> => {
    const params = buildQueryParams({
      lead_id: data.lead_id,
      current_status: data.current_status,
      requested_status: data.requested_status,
      reason: data.reason,
    });
    
    const response = await apiClient.post('/approvals/request', null, { params });
    return response.data;
  },
  
  getPendingRequests: async (): Promise<{
    requests: Array<{
      id: number;
      lead_id: number;
      lead_name: string;
      requested_by_name: string;
      current_status: string;
      requested_status: string;
      reason: string;
      created_at: string;
    }>;
    count: number;
  }> => {
    const response = await apiClient.get('/approvals/pending');
    return response.data;
  },
  
  resolveRequest: async (
    requestId: number,
    approved: boolean,
    resolutionNote?: string
  ): Promise<{ status: string; message: string }> => {
    const params = buildQueryParams({
      approved: approved,
      resolution_note: resolutionNote,
    });
    
    const response = await apiClient.post(`/approvals/${requestId}/resolve`, null, { params });
    return response.data;
  },
  
  getLeadRequests: async (leadId: number): Promise<{
    requests: Array<{
      id: number;
      current_status: string;
      requested_status: string;
      reason: string;
      request_status: string;
      requested_by_name: string;
      resolved_by_name: string | null;
      created_at: string;
      resolved_at: string | null;
    }>;
  }> => {
    const response = await apiClient.get(`/approvals/lead/${leadId}`);
    return response.data;
  },
};

export default apiClient;

