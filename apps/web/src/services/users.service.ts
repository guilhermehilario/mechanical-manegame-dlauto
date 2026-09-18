import type { Paginated, UserDto } from '@mechanic-system/types';
import type { CreateUserInput } from '@mechanic-system/validation';
import { api } from './auth.service';

/**
 * User management (Bloco D/D2) — admin/manager surface. The API enforces the
 * roles; the UI also hides the nav entry for other roles (AppLayout).
 */
export function listUsers(
  params: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: 'name' | 'email' | 'role' | 'createdAt';
    sortDir?: 'asc' | 'desc';
  } = {},
): Promise<Paginated<UserDto>> {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 1));
  query.set('limit', String(params.limit ?? 20));
  if (params.search) query.set('search', params.search);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortDir) query.set('sortDir', params.sortDir);
  return api.get<Paginated<UserDto>>(`/users?${query.toString()}`);
}

export function createUser(input: CreateUserInput): Promise<UserDto> {
  return api.post<UserDto>('/users', input);
}

export function deactivateUser(id: string): Promise<unknown> {
  return api.delete<unknown>(`/users/${id}`);
}

export function adminResetPassword(id: string, newPassword: string): Promise<unknown> {
  return api.patch<unknown>(`/users/${id}/password`, { newPassword });
}

export function changeMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<unknown> {
  return api.patch<unknown>('/users/me/password', { currentPassword, newPassword });
}
