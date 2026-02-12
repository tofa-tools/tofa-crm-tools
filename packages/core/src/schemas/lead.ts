import { z } from 'zod';

/**
 * Lead Status Enum
 * Matches the backend LeadStatus type
 */
export const LeadStatusSchema = z.enum([
  'New',
  'Called',
  'Followed up with message',
  'Trial Scheduled',
  'Trial Attended',
  'Payment Pending Verification',
  'Joined',
  'On Break',
  'Nurture',
  'Dead/Not Interested',
]);

export type LeadStatus = z.infer<typeof LeadStatusSchema>;

/**
 * Complete Lead Schema
 * Used for API response validation and type safety
 */
// Helper to parse datetime strings (handles ISO 8601 with timezone)
const datetimeString = z.string().refine(
  (val: any) => {
    if (!val) return true; // Allow null/empty for nullable fields
    // Check if it's a valid ISO 8601 datetime string
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
    return isoRegex.test(val) && !isNaN(Date.parse(val));
  },
  { message: "Invalid datetime format" }
);

export const LeadSchema = z.object({
  id: z.number(),
  created_time: datetimeString.nullable(), // Allow null for edge cases
  player_name: z.string().min(1),
  phone: z.string().nullable(), // CRITICAL: Nullable for coach privacy masking (coaches see null)
  email: z.string().nullable(),
  address: z.string().nullable(),
  status: LeadStatusSchema,
  next_followup_date: datetimeString.nullable(),
  center_id: z.number().nullable().optional(),
  // Optional fields that might come from backend
  last_updated: datetimeString.nullable().optional(),
  date_of_birth: z.string().date().nullable().optional(),
  extra_data: z.record(z.any()).optional(),
  trial_batch_id: z.number().nullable().optional(),
  permanent_batch_id: z.number().nullable().optional(),
  student_batch_ids: z.array(z.number()).optional(), // Multi-batch assignment (from API)
  public_token: z.string().nullable().optional(),
  preferred_batch_id: z.number().nullable().optional(),
  preferred_call_time: z.string().nullable().optional(),
  preferred_timing_notes: z.string().nullable().optional(),
  loss_reason: z.string().nullable().optional(),
  loss_reason_notes: z.string().nullable().optional(),
  reschedule_count: z.number().int().default(0).optional(),
  nudge_count: z.number().int().default(0).optional(),
  do_not_contact: z.boolean().default(false).optional(),
  subscription_plan: z.string().nullable().optional(), // 'Monthly', 'Quarterly', '6 Months', 'Yearly'
  subscription_start_date: z.string().date().nullable().optional(),
  subscription_end_date: z.string().date().nullable().optional(),
  payment_proof_url: z.string().nullable().optional(),
  call_confirmation_note: z.string().nullable().optional(),
  // Enrollment flow (public join page → Payment Pending Verification)
  enrollment_link_sent_at: datetimeString.nullable().optional(),
  link_expires_at: datetimeString.nullable().optional(),
  pending_subscription_data: z.record(z.any()).nullable().optional(), // { email, plan, start_date, batch_id, utr_number?, payment_proof_url?, ... }
});

export type Lead = z.infer<typeof LeadSchema>;

/**
 * Lead Update Schema
 * Used for form validation when updating a lead
 */
export const LeadUpdateSchema = z.object({
  status: LeadStatusSchema.optional(),
  next_date: z.string().date().nullable().optional(),
  comment: z.string().nullable().optional(),
  trial_batch_id: z.number().nullable().optional(),
  permanent_batch_id: z.number().nullable().optional(),
  student_batch_ids: z.array(z.number()).optional(), // Multi-batch assignment
  subscription_plan: z.string().nullable().optional(),
  subscription_start_date: z.string().date().nullable().optional(),
  subscription_end_date: z.string().date().nullable().optional(),
  payment_proof_url: z.string().nullable().optional(),
  call_confirmation_note: z.string().nullable().optional(),
  loss_reason: z.string().nullable().optional(),
  loss_reason_notes: z.string().nullable().optional(),
});

export type LeadUpdate = z.infer<typeof LeadUpdateSchema>;

/**
 * Lead Form Schema (for creating new leads)
 * Could be extended if manual lead entry is needed
 */
export const LeadCreateSchema = z.object({
  player_name: z.string().min(1, 'Player name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email('Invalid email format').nullable().optional().or(z.literal('')),
  address: z.string().nullable().optional(),
  center_id: z.number().min(1, 'Center is required'),
});

export type LeadCreate = z.infer<typeof LeadCreateSchema>;

