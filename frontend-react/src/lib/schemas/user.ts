import { z } from 'zod';

/**
 * User Role Enum
 */
export const UserRoleSchema = z.enum(['team_lead', 'regular_user', 'observer', 'coach']);

export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Complete User Schema
 * Used for API response validation
 */
export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  full_name: z.string().min(1),
  role: UserRoleSchema,
  // Optional fields that might come from backend
  center_ids: z.array(z.number()).optional(),
});

export type User = z.infer<typeof UserSchema>;

/**
 * User Create Schema
 * Used for form validation when creating a new user
 */
export const UserCreateSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1, 'Full name is required'),
  role: UserRoleSchema,
  center_ids: z.array(z.number()).min(1, 'At least one center must be selected'),
});

export type UserCreate = z.infer<typeof UserCreateSchema>;

