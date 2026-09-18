import type { UserRole } from './user';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * First-run setup status (Bloco F/F1). `needsSetup` is true while the
 * database has no active ADMIN — the web shows the first-access screen
 * instead of the login form.
 */
export interface SetupStatus {
  needsSetup: boolean;
}
