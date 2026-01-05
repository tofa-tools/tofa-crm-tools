import { z } from 'zod';

/**
 * Lead Status Enum
 * Matches the backend LeadStatus type
 */
export const LeadStatusSchema = z.enum([
  'New',
  'Called',
  'Trial Scheduled',
  'Trial Attended',
  'Joined',
  'Nurture',
  'Dead/Not Interested',
]);

export type LeadStatus = z.infer<typeof LeadStatusSchema>;

/**
 * Complete Lead Schema
 * Used for API response validation and type safety
 */
export const LeadSchema = z.object({
  id: z.number(),
  created_time: z.string().datetime().nullable(), // Allow null for edge cases
  player_name: z.string().min(1),
  player_age_category: z.string(),
  phone: z.string().nullable(), // CRITICAL: Nullable for coach privacy masking (coaches see null)
  email: z.string().nullable(),
  address: z.string().nullable(),
  status: LeadStatusSchema,
  next_followup_date: z.string().datetime().nullable(),
  center_id: z.number().nullable().optional(),
  // Optional fields that might come from backend
  last_updated: z.string().datetime().nullable().optional(),
  score: z.number().int().min(0).max(5).default(0).optional(),
  date_of_birth: z.string().date().nullable().optional(),
  extra_data: z.record(z.any()).optional(),
  trial_batch_id: z.number().nullable().optional(),
  permanent_batch_id: z.number().nullable().optional(),
  public_token: z.string().nullable().optional(),
  preferred_batch_id: z.number().nullable().optional(),
  preferred_call_time: z.string().nullable().optional(),
  preferred_timing_notes: z.string().nullable().optional(),
  loss_reason: z.string().nullable().optional(),
  loss_reason_notes: z.string().nullable().optional(),
  reschedule_count: z.number().int().default(0).optional(),
  do_not_contact: z.boolean().default(false).optional(),
  subscription_plan: z.string().nullable().optional(), // 'Monthly', 'Quarterly', '6 Months', 'Yearly'
  subscription_start_date: z.string().date().nullable().optional(),
  subscription_end_date: z.string().date().nullable().optional(),
});

export type Lead = z.infer<typeof LeadSchema>;

/**
 * Lead Update Schema
 * Used for form validation when updating a lead
 */
export const LeadUpdateSchema = z.object({
  status: LeadStatusSchema,
  next_date: z.string().date().nullable().optional(),
  comment: z.string().nullable().optional(),
  trial_batch_id: z.number().nullable().optional(),
  permanent_batch_id: z.number().nullable().optional(),
  student_batch_ids: z.array(z.number()).optional(), // Multi-batch assignment
  subscription_plan: z.string().nullable().optional(),
  subscription_start_date: z.string().date().nullable().optional(),
  subscription_end_date: z.string().date().nullable().optional(),
});

export type LeadUpdate = z.infer<typeof LeadUpdateSchema>;

/**
 * Lead Form Schema (for creating new leads)
 * Could be extended if manual lead entry is needed
 */
export const LeadCreateSchema = z.object({
  player_name: z.string().min(1, 'Player name is required'),
  player_age_category: z.string().min(1, 'Age category is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email('Invalid email format').nullable().optional().or(z.literal('')),
  address: z.string().nullable().optional(),
  center_id: z.number().min(1, 'Center is required'),
});

export type LeadCreate = z.infer<typeof LeadCreateSchema>;

