import { z } from 'zod';
import { createUserSchema } from './user';

/** Admin password reset (Bloco D): no current password — caller is ADMIN. */
export const adminResetPasswordSchema = z.object({
  newPassword: createUserSchema.shape.password,
});
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

/**
 * Service-layer input: the controller injects the acting admin's id from the
 * JWT (never from the body) so the service can refuse self-reset through
 * this path and audit who acted.
 */
export type AdminResetPasswordServiceInput = AdminResetPasswordInput & {
  _actingAdminId: string;
};
