import { z } from 'zod';

/**
 * Batch Schema
 * Represents a training group/session
 */
export const BatchSchema = z.object({
  id: z.number(),
  name: z.string(),
  center_id: z.number(),
  min_age: z.number(),
  max_age: z.number(),
  max_capacity: z.number(),
  is_mon: z.boolean(),
  is_tue: z.boolean(),
  is_wed: z.boolean(),
  is_thu: z.boolean(),
  is_fri: z.boolean(),
  is_sat: z.boolean(),
  is_sun: z.boolean(),
  start_time: z.string().nullable().optional(), // Time in HH:MM:SS format
  end_time: z.string().nullable().optional(), // Time in HH:MM:SS format
  start_date: z.string(), // Date in YYYY-MM-DD format
  end_date: z.string().nullable().optional(), // Date in YYYY-MM-DD format (optional, for batches with end dates)
  is_active: z.boolean(), // Whether the batch is currently active
  coaches: z.array(z.object({
    id: z.number(),
    full_name: z.string(),
    email: z.string(),
  })).optional(), // Coaches assigned to this batch
});

export type Batch = z.infer<typeof BatchSchema>;

/**
 * Batch Create Schema
 */
export const BatchCreateSchema = z.object({
  name: z.string().min(1, 'Batch name is required'),
  center_id: z.number().min(1, 'Center is required'),
  min_age: z.number().min(0).default(0),
  max_age: z.number().min(0).default(99),
  max_capacity: z.number().min(1).default(20),
  is_mon: z.boolean().default(false),
  is_tue: z.boolean().default(false),
  is_wed: z.boolean().default(false),
  is_thu: z.boolean().default(false),
  is_fri: z.boolean().default(false),
  is_sat: z.boolean().default(false),
  is_sun: z.boolean().default(false),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  start_date: z.string(), // Date in YYYY-MM-DD format (required)
  is_active: z.boolean().default(true), // Whether the batch is currently active
  coach_ids: z.array(z.number()).min(1, 'At least one coach must be assigned'),
});

export type BatchCreate = z.infer<typeof BatchCreateSchema>;

