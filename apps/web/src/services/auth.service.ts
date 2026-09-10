import type { AuthUser, LoginResponse, RefreshResponse } from '@mechanic-system/types';
import type { LoginInput } from '@mechanic-system/validation';
import { authStore } from './auth-store';
import { ApiClient } from './api-client';
import { resolveApiBaseUrl } from './api-url';

/** Single shared client bound to the current session token. */
export const api = new ApiClient({
  baseUrl: resolveApiBaseUrl(),
  getToken: () => authStore.getAccessToken(),
});

export async function login(input: LoginInput): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', input);
  authStore.setSession(response);
  return response;
}

export async function refreshSession(): Promise<boolean> {
  const { refreshToken } = authStore.getSession();
  if (!refreshToken) return false;
  try {
    const tokens = await api.post<RefreshResponse>('/auth/refresh', { refreshToken });
    authStore.setTokens(tokens);
    return true;
  } catch {
    authStore.clear();
    return false;
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    authStore.clear();
  }
}

export function getCurrentUser(): AuthUser | null {
  return authStore.getUser();
}
