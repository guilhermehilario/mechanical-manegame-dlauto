import type { AuthUser, LoginResponse } from '@mechanic-system/types';

/**
 * Auth session state (spec §20).
 * Tokens are held in memory ONLY — never localStorage/sessionStorage —
 * limiting the impact of any XSS. A page reload requires a new login for now;
 * a future phase can add a silent-refresh flow via the preload bridge.
 */

interface SessionState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

let state: SessionState = { user: null, accessToken: null, refreshToken: null };
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export const authStore = {
  getSession: (): SessionState => state,

  getUser: (): AuthUser | null => state.user,

  getAccessToken: (): string | null => state.accessToken,

  setSession: (login: LoginResponse): void => {
    state = {
      user: login.user,
      accessToken: login.accessToken,
      refreshToken: login.refreshToken,
    };
    notify();
  },

  setTokens: (tokens: { accessToken: string; refreshToken: string }): void => {
    state = { ...state, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    notify();
  },

  clear: (): void => {
    state = { user: null, accessToken: null, refreshToken: null };
    notify();
  },

  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
