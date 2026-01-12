import { z } from 'zod';

/**
 * Attendance Status Enum
 */
export const AttendanceStatusSchema = z.enum(['Present', 'Absent', 'Excused', 'Late']);

export type AttendanceStatus = z.infer<typeof AttendanceStatusSchema>;

/**
 * Attendance Schema
 */
export const AttendanceSchema = z.object({
  id: z.number(),
  lead_id: z.number(),
  batch_id: z.number(),
  user_id: z.number(),
  date: z.string().date(),
  status: AttendanceStatusSchema,
  remarks: z.string().nullable().optional(),
  recorded_at: z.string().datetime().optional(),
});

export type Attendance = z.infer<typeof AttendanceSchema>;

/**
 * Attendance Create Schema
 */
export const AttendanceCreateSchema = z.object({
  lead_id: z.number().optional(), // Optional - used for trial students
  student_id: z.number().optional(), // Optional - used for active students
  batch_id: z.number().min(1, 'Batch ID is required'),
  status: AttendanceStatusSchema,
  date: z.string().date().optional(), // Optional, defaults to today on backend
  remarks: z.string().nullable().optional(),
}).refine((data) => data.lead_id || data.student_id, {
  message: "Either lead_id or student_id is required",
});

export type AttendanceCreate = z.infer<typeof AttendanceCreateSchema>;

