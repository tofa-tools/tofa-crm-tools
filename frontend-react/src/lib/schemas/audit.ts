import { z } from 'zod';

/**
 * Audit Log Action Types
 */
export const AuditLogActionTypeSchema = z.enum([
  'status_change',
  'comment_added',
  'assignment_change',
  'field_update',
]);

export type AuditLogActionType = z.infer<typeof AuditLogActionTypeSchema>;

/**
 * Audit Log Schema
 */
export const AuditLogSchema = z.object({
  id: z.number(),
  lead_id: z.number(),
  user_id: z.number(),
  action_type: AuditLogActionTypeSchema,
  description: z.string(),
  old_value: z.string().nullable().optional(),
  new_value: z.string().nullable().optional(),
  timestamp: z.string().datetime(),
  // Related objects (optional, may be included in API response)
  user: z.object({
    id: z.number(),
    full_name: z.string(),
    email: z.string(),
  }).optional(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

