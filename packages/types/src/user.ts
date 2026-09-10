/** User roles (least privilege, spec §20/§41). */
export const USER_ROLES = ['ADMIN', 'MANAGER', 'MECHANIC', 'ATTENDANT'] as const;

export type UserRole = (typeof USER_ROLES)[number];
