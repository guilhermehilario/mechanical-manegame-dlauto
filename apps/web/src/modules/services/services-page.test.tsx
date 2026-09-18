import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ServicesPage } from './services-page';
import type { AuthUser, Paginated, ServiceDto } from '@mechanic-system/types';

const mocks = vi.hoisted(() => ({
  listServices: vi.fn(),
  deleteService: vi.fn(),
  seedCatalogExample: vi.fn(),
  authUser: { current: null as AuthUser | null },
}));

vi.mock('../../services/catalog.service', () => ({
  listServices: mocks.listServices,
  deleteService: mocks.deleteService,
  seedCatalogExample: mocks.seedCatalogExample,
  listProducts: vi.fn(),
  listSuppliers: vi.fn(),
}));

vi.mock('../auth/use-auth', () => ({
  useAuth: () => ({ user: mocks.authUser.current }),
}));

function renderPage(): void {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ServicesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const admin: AuthUser = {
  id: 'usr_admin',
  name: 'Ana Admin',
  email: 'ana@oficina.local',
  role: 'ADMIN',
};

const attendant: AuthUser = {
  id: 'usr_atend',
  name: 'Paula Atendente',
  email: 'paula@oficina.local',
  role: 'ATTENDANT',
};

const emptyPage: Paginated<ServiceDto> = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };

describe('ServicesPage empty state (F3/F4)', () => {
  beforeEach(() => {
    mocks.listServices.mockResolvedValue(emptyPage);
    mocks.deleteService.mockResolvedValue({ success: true });
  });

  it('shows create + seed CTAs for an admin with an empty catalog', async () => {
    mocks.authUser.current = admin;
    renderPage();

    expect(await screen.findByText('Nenhum serviço encontrado.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Criar primeiro serviço' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Carregar catálogo de exemplo' }),
    ).toBeTruthy();
  });

  it('shows the example catalog CTA only for ADMIN/MANAGER roles', async () => {
    mocks.authUser.current = attendant;
    renderPage();

    expect(await screen.findByText('Nenhum serviço encontrado.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Criar primeiro serviço' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Carregar catálogo de exemplo' })).toBeNull();
  });

  it('loads the example catalog and reports the result', async () => {
    mocks.authUser.current = admin;
    mocks.seedCatalogExample.mockResolvedValue({
      services: 10,
      products: 8,
      suppliers: 3,
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Carregar catálogo de exemplo' }),
    );

    expect(await screen.findByText('Catálogo de exemplo carregado (10 serviços, 8 produtos, 3 fornecedores).')).toBeTruthy();
  });
});