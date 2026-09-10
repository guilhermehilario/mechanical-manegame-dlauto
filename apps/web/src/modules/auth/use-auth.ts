import { useSyncExternalStore } from 'react';
import type { AuthUser } from '@mechanic-system/types';
import type { LoginInput } from '@mechanic-system/validation';
import { authStore } from '../../services/auth-store';
import * as authService from '../../services/auth.service';

interface UseAuthResult {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isPending: boolean;
  error: string | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Separation of concerns (spec §23): this hook owns session STATE via the
 * external store; the service layer owns HTTP; components own UI only.
 */
export function useAuth(): UseAuthResult {
  const user = useSyncExternalStore(authStore.subscribe, authStore.getUser);

  return {
    user,
    isAuthenticated: user !== null,
    isPending: false,
    error: null,
    login: async (input) => {
      await authService.login(input);
    },
    logout: async () => {
      await authService.logout();
    },
  };
}
