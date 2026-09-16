import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPage } from './settings-page';
import type { ShopSettingsDto } from '@mechanic-system/types';

const mocks = vi.hoisted(() => ({
  getShopSettings: vi.fn(),
  updateShopSettings: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../../services/settings.service', () => ({
  getShopSettings: mocks.getShopSettings,
  updateShopSettings: mocks.updateShopSettings,
}));

vi.mock('../auth/use-auth', () => ({
  useAuth: mocks.useAuth,
}));

const settings: ShopSettingsDto = {
  name: 'Auto Center DL',
  phone: '1133334444',
  address: 'Rua das Flores, 100',
  documentFooter: 'Obrigado!',
  updatedAt: '2026-09-16T12:00:00.000Z',
};

function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

describe('SettingsPage (Bloco F2 mínimo)', () => {
  beforeEach(() => {
    mocks.getShopSettings.mockReset();
    mocks.updateShopSettings.mockReset();
    mocks.getShopSettings.mockResolvedValue(settings);
    mocks.updateShopSettings.mockResolvedValue(settings);
  });

  it('renders the current settings', async () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'ADMIN' } });

    renderPage();

    const nameInput = await screen.findByLabelText(/Nome da oficina/);
    expect(nameInput).toHaveProperty('value', 'Auto Center DL');
    expect(screen.getByLabelText('Endereço')).toHaveProperty('value', 'Rua das Flores, 100');
  });

  it('submits edited values', async () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'ADMIN' } });

    renderPage();
    const nameInput = await screen.findByLabelText(/Nome da oficina/);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Oficina Nova');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      // useMutation passes extra context args after the input — check the first.
      expect(mocks.updateShopSettings.mock.calls[0]?.[0]).toEqual({
        name: 'Oficina Nova',
        phone: '1133334444',
        address: 'Rua das Flores, 100',
        documentFooter: 'Obrigado!',
      });
    });
    expect(await screen.findByText('Configurações salvas.')).toBeTruthy();
  });

  it('blocks editing for ATTENDANT', async () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'ATTENDANT' } });

    renderPage();

    expect(await screen.findByLabelText(/Nome da oficina/)).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    expect(screen.getByText(/Somente administradores/)).toBeTruthy();
  });

  it('does not submit an empty shop name', async () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'ADMIN' } });

    renderPage();
    const nameInput = await screen.findByLabelText(/Nome da oficina/);
    await userEvent.clear(nameInput);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(mocks.updateShopSettings).not.toHaveBeenCalled();
  });
});
