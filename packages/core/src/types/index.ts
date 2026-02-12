// Re-export Zod schemas and types for backward compatibility
export type { User, UserCreate, UserUpdate, UserRole } from '../schemas/user';
export { UserSchema, UserCreateSchema, UserUpdateSchema, UserRoleSchema } from '../schemas/user';

// Center types
export interface Center {
  id: number;
  display_name: string;
  meta_tag_name: string;
  city: string;
  location: string;
  map_link?: string | null;
  group_email?: string | null;
}

export interface CenterCreate {
  display_name: string;
  meta_tag_name: string;
  city: string;
  location?: string;
  map_link?: string | null;
  group_email?: string | null;
}

// Age calculation from DOB
export { calculateAge } from '../logic/age-groups';

// Re-export Lead schemas and types
export type { Lead, LeadStatus, LeadUpdate, LeadCreate } from '../schemas/lead';
export { LeadSchema, LeadUpdateSchema, LeadCreateSchema, LeadStatusSchema } from '../schemas/lead';

// Re-export Batch schemas and types
export type { Batch, BatchCreate } from '../schemas/batch';
export { BatchSchema, BatchCreateSchema } from '../schemas/batch';

// Re-export Attendance schemas and types
export type { Attendance, AttendanceStatus, AttendanceCreate } from '../schemas/attendance';
export { AttendanceSchema, AttendanceStatusSchema, AttendanceCreateSchema } from '../schemas/attendance';

// Re-export Audit Log types
export type { AuditLog, AuditLogActionType } from '../schemas/audit';
export { AuditLogSchema, AuditLogActionTypeSchema } from '../schemas/audit';

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
export type { ImportPreviewRow, ImportPreviewResponse } from '../schemas/import';
export { ImportPreviewResponseSchema, ImportPreviewRowSchema } from '../schemas/import';

// Notification types (aligned with backend Notification model)
export type NotificationCategory =
  | 'SALES_ALERT'
  | 'OPS_ALERT'
  | 'FINANCE_ALERT'
  | 'GOVERNANCE_ALERT';

export interface Notification {
  id: number;
  user_id: number;
  type: NotificationCategory;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

