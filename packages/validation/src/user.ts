import { z } from 'zod';
import { USER_ROLES } from '@mechanic-system/types';

export const UserRole = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof UserRole>;

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(255).toLowerCase(),
  password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'password must contain a letter')
    .regex(/[0-9]/, 'password must contain a number'),
  role: UserRole.default('ATTENDANT'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema
  .partial()
  .omit({ password: true })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'at least one field must be provided',
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: createUserSchema.shape.password,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
