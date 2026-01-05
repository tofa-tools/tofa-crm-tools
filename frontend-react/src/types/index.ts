// Re-export Zod schemas and types for backward compatibility
export type { User, UserCreate, UserRole } from '@/lib/schemas/user';
export { UserSchema, UserCreateSchema, UserRoleSchema } from '@/lib/schemas/user';

// Center types
export interface Center {
  id: number;
  display_name: string;
  meta_tag_name: string;
  city: string;
  location: string;
}

export interface CenterCreate {
  display_name: string;
  meta_tag_name: string;
  city: string;
  location?: string;
}

// Re-export Lead schemas and types
export type { Lead, LeadStatus, LeadUpdate, LeadCreate } from '@/lib/schemas/lead';
export { LeadSchema, LeadUpdateSchema, LeadCreateSchema, LeadStatusSchema } from '@/lib/schemas/lead';

// Re-export Batch schemas and types
export type { Batch, BatchCreate } from '@/lib/schemas/batch';
export { BatchSchema, BatchCreateSchema } from '@/lib/schemas/batch';

// Re-export Attendance schemas and types
export type { Attendance, AttendanceStatus, AttendanceCreate } from '@/lib/schemas/attendance';
export { AttendanceSchema, AttendanceStatusSchema, AttendanceCreateSchema } from '@/lib/schemas/attendance';

// Re-export Audit Log types
export type { AuditLog, AuditLogActionType } from '@/lib/schemas/audit';
export { AuditLogSchema, AuditLogActionTypeSchema } from '@/lib/schemas/audit';

// Comment types
export interface Comment {
  id: number;
  text: string;
  timestamp: string;
  user_id: number;
  lead_id: number;
  mentioned_user_ids?: string; // JSON array string
}

// Auth types
export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
}

export interface AuthUser {
  email: string;
  role: string;
}

// API Response types
export interface ApiError {
  detail: string;
}

export interface UploadResponse {
  status: 'success' | 'error';
  message?: string;
  leads_added?: number;
  unknown_tags?: string[];
}

// Import Preview types
export type { ImportPreviewRow, ImportPreviewResponse } from '@/lib/schemas/import';
export { ImportPreviewResponseSchema, ImportPreviewRowSchema } from '@/lib/schemas/import';


