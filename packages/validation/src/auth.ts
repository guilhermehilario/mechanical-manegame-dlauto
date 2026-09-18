import { z } from 'zod';
import { createUserSchema } from './user';

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).max(2048),
});

export type RefreshInput = z.infer<typeof refreshSchema>;

/**
 * First-run admin provisioning (Bloco F/F1). The password follows the same
 * complexity rule as user creation (letter + number, min 8) — there is no
 * default credential (R4/SEC-04).
 */
export const setupAdminSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(255).toLowerCase(),
  password: createUserSchema.shape.password,
});

export type SetupAdminInput = z.infer<typeof setupAdminSchema>;
