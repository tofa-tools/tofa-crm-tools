// User types
export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'team_member' | 'team_lead' | 'observer';
}

export interface UserCreate {
  email: string;
  password: string;
  full_name: string;
  role: string;
  center_ids: number[];
}

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

// Lead types
export interface Lead {
  id: number;
  created_time: string;
  player_name: string;
  player_age_category: string;
  phone: string;
  email: string | null;
  address: string | null;
  status: LeadStatus;
  next_followup_date: string | null;
  center_id: number;
}

export type LeadStatus = 
  | 'New' 
  | 'Called' 
  | 'Trial Scheduled' 
  | 'Joined' 
  | 'Dead/Not Interested';

export interface LeadUpdate {
  status: LeadStatus;
  next_date?: string | null;
  comment?: string | null;
}

// Comment types
export interface Comment {
  id: number;
  text: string;
  timestamp: string;
  user_id: number;
  lead_id: number;
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


