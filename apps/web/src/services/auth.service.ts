import type {
  AuthUser,
  LoginResponse,
  RefreshResponse,
  SetupStatus,
} from '@mechanic-system/types';
import type { LoginInput, SetupAdminInput } from '@mechanic-system/validation';
import { authStore } from './auth-store';
import { ApiClient } from './api-client';
import { resolveApiBaseUrl } from './api-url';
import {
  clearDesktopSession,
  readDesktopSession,
  saveSessionToDesktop,
} from './desktop-bridge';

/** Single shared client bound to the current session token. On a 401 it
 * refreshes once and retries (see ApiClient); if the refresh fails the
 * store is wiped and the router lands back on the login screen. */
export const api = new ApiClient({
  baseUrl: resolveApiBaseUrl(),
  getToken: () => authStore.getAccessToken(),
  onUnauthorized: () => refreshSession(),
});

/**
 * Sessions (spec §20 + Bloco D/D1):
 *  - tokens live in memory ONLY inside the renderer (never localStorage —
 *    anti-XSS posture unchanged);
 *  - on desktop (Electron bridge present), the REFRESH token is mirrored to
 *    the main process (userData/session.json, 0600) so the app can restore
 *    the session on the next launch via silent refresh;
 *  - in the plain browser there is no bridge → no persistence, exactly as
 *    before (dev flow unaffected).
 */

/** Mirrors the current session to the desktop store (no-op in browser). */
function persistToDesktop(login: LoginResponse): void {
  void saveSessionToDesktop({
    savedAt: new Date().toISOString(),
    refreshToken: login.refreshToken,
    user: {
      id: login.user.id,
      name: login.user.name,
      email: login.user.email,
      role: login.user.role,
    },
  }).catch(() => undefined);
}

function wipeDesktop(): void {
  void clearDesktopSession().catch(() => undefined);
}

export async function login(input: LoginInput): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', input);
  authStore.setSession(response);
  persistToDesktop(response);
  return response;
}

/**
 * First-run setup (F1): public status check + creation of the very first
 * ADMIN. Both hit @Public() endpoints; the POST is refused by the API once
 * an admin exists (409 SETUP_ALREADY_COMPLETED).
 */
export function getSetupStatus(): Promise<SetupStatus> {
  return api.get<SetupStatus>('/auth/setup');
}

export function setupFirstAdmin(input: SetupAdminInput): Promise<AuthUser> {
  return api.post<AuthUser>('/auth/setup', input);
}

export async function refreshSession(): Promise<boolean> {
  const { refreshToken } = authStore.getSession();
  if (!refreshToken) return false;
  try {
    const tokens = await api.post<RefreshResponse>('/auth/refresh', { refreshToken });
    authStore.setTokens(tokens);
    // Rotation produced a NEW refresh token — keep the mirror up to date.
    persistToDesktop({
      user: authStore.getUser() as AuthUser,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    return true;
  } catch {
    authStore.clear();
    wipeDesktop();
    return false;
  }
}

/**
 * Boot-time silent refresh (D1): desktop-only. Reads the refresh token
 * stored on the Node side of the bridge and tries to restore the session.
 * Any failure (missing/expired/revoked token, inactive user) lands back on
 * the login screen with the store wiped — the user just logs in again.
 */
export async function restoreDesktopSession(): Promise<boolean> {
  try {
    const stored = await readDesktopSession();
    if (!stored?.refreshToken) return false;

    const tokens = await api.post<RefreshResponse>('/auth/refresh', {
      refreshToken: stored.refreshToken,
    });
    const user: AuthUser = {
      id: stored.user.id,
      name: stored.user.name,
      email: stored.user.email,
      role: stored.user.role as AuthUser['role'],
    };
    authStore.setSession({ user, ...tokens });
    // The presented refresh token was rotated — persist the new one.
    persistToDesktop({ user, ...tokens });
    return true;
  } catch {
    wipeDesktop();
    return false;
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    authStore.clear();
    wipeDesktop();
  }
}

/** Called after a self-service password change: server revoked the family. */
export function forgetDesktopSession(): void {
  wipeDesktop();
}

export function getCurrentUser(): AuthUser | null {
  return authStore.getUser();
}
