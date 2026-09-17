import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { UsersPage } from './users-page';
import type { AuthUser, UserDto } from '@mechanic-system/types';

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  deactivateUser: vi.fn(),
  adminResetPassword: vi.fn(),
  authUser: { current: null as AuthUser | null },
}));

vi.mock('../../services/users.service', () => ({
  listUsers: mocks.listUsers,
  createUser: mocks.createUser,
  deactivateUser: mocks.deactivateUser,
  adminResetPassword: mocks.adminResetPassword,
}));

vi.mock('../auth/use-auth', () => ({
  useAuth: () => ({ user: mocks.authUser.current }),
}));

const admin: UserDto = {
  id: 'usr_admin',
  name: 'Ana Admin',
  email: 'ana@oficina.local',
  role: 'ADMIN',
  active: true,
  createdAt: '2026-01-01T10:00:00.000Z',
};

const manager: UserDto = {
  id: 'usr_manager',
  name: 'Marcos Gerente',
  email: 'marcos@oficina.local',
  role: 'MANAGER',
  active: true,
  createdAt: '2026-01-02T10:00:00.000Z',
};

const mechanic: UserDto = {
  id: 'usr_mechanic',
  name: 'Mário Mecânico',
  email: 'mario@oficina.local',
  role: 'MECHANIC',
  active: true,
  createdAt: '2026-01-03T10:00:00.000Z',
};

function renderPage(role: AuthUser['role']): void {
  mocks.authUser.current = {
    id: `usr_${role}`,
    name: 'Current',
    email: 'current@oficina.local',
    role,
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('UsersPage role gating', () => {
  it('ADMIN manages all users but only resets ADMIN/MANAGER passwords', async () => {
    mocks.listUsers.mockResolvedValue({
      items: [admin, manager, mechanic],
      total: 3,
      page: 1,
      totalPages: 1,
    });

    renderPage('ADMIN');

    expect(await screen.findByText('Ana Admin')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Novo usuário' })).toBeTruthy();
    // One "Redefinir senha" per ADMIN/MANAGER row — not for the MECHANIC.
    expect(screen.getAllByRole('button', { name: 'Redefinir senha' }).length).toBe(2);
    expect(screen.getAllByRole('button', { name: 'Desativar' }).length).toBe(3);
  });

  it('MANAGER sees the list read-only (no management actions)', async () => {
    mocks.listUsers.mockResolvedValue({
      items: [admin, manager, mechanic],
      total: 3,
      page: 1,
      totalPages: 1,
    });

    renderPage('MANAGER');

    expect(await screen.findByText('Ana Admin')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Novo usuário' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Redefinir senha' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Desativar' })).toBeNull();
  });

  it('MECHANIC sees the list read-only (no management actions)', async () => {
    mocks.listUsers.mockResolvedValue({
      items: [admin, manager, mechanic],
      total: 3,
      page: 1,
      totalPages: 1,
    });

    renderPage('MECHANIC');

    expect(await screen.findByText('Ana Admin')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Novo usuário' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Redefinir senha' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Desativar' })).toBeNull();
  });
});
