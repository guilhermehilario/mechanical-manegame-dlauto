/** User roles (least privilege, spec §20/§41). */
export const USER_ROLES = ['ADMIN', 'MANAGER', 'MECHANIC', 'ATTENDANT'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * Public user shape returned by the API (never includes passwordHash,
 * spec §20). `createdAt` is ISO-8601 over the wire.
 */
export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}
