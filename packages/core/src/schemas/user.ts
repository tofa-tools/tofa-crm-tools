import { z } from 'zod';

/**
 * User Role Enum
 */
export const UserRoleSchema = z.enum(['team_lead', 'team_member', 'observer', 'coach']);

export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Complete User Schema
 * Used for API response validation
 */
export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  full_name: z.string().min(1),
  phone: z.string().nullable().optional(),
  role: UserRoleSchema,
  is_active: z.boolean().optional().default(true),
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
  phone: z.string().min(1, 'Phone number is required'),
  role: UserRoleSchema,
  center_ids: z.array(z.number()).min(1, 'At least one center must be selected'),
});

export type UserCreate = z.infer<typeof UserCreateSchema>;

/**
 * User Update Schema
 * Used for form validation when updating an existing user
 */
export const UserUpdateSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').optional(),
  phone: z.string().optional().nullable(),
  role: UserRoleSchema.optional(),
  is_active: z.boolean().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  center_ids: z.array(z.number()).optional(),
});

export type UserUpdate = z.infer<typeof UserUpdateSchema>;

