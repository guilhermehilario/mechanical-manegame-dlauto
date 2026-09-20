import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from './settings-page';
import type { BackupConfigDto, BackupStatusDto, ShopSettingsDto } from '@mechanic-system/types';

const mocks = vi.hoisted(() => ({
  getShopSettings: vi.fn(),
  updateShopSettings: vi.fn(),
  getBackupConfig: vi.fn(),
  updateBackupConfig: vi.fn(),
  createBackup: vi.fn(),
  getBackupStatus: vi.fn(),
  seedCatalogExample: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../../services/settings.service', () => ({
  getShopSettings: mocks.getShopSettings,
  updateShopSettings: mocks.updateShopSettings,
}));

vi.mock('../../services/backups.service', () => ({
  getBackupConfig: mocks.getBackupConfig,
  updateBackupConfig: mocks.updateBackupConfig,
  createBackup: mocks.createBackup,
}));

vi.mock('../../services/backup-status.service', () => ({
  getBackupStatus: mocks.getBackupStatus,
}));

vi.mock('../../services/catalog.service', () => ({
  seedCatalogExample: mocks.seedCatalogExample,
}));

vi.mock('../auth/use-auth', () => ({
  useAuth: mocks.useAuth,
}));

const settings: ShopSettingsDto = {
  timeFormat: 'H24',
  name: 'Auto Center DL',
  phone: '1133334444',
  address: 'Rua das Flores, 100',
  documentFooter: 'Obrigado!',
  updatedAt: '2026-09-16T12:00:00.000Z',
};

const backupConfig: BackupConfigDto = {
  autoEnabled: true,
  intervalHours: 24,
  keep: 14,
  alertAfterHours: 24,
};

const backupStatus: BackupStatusDto = {
  latest: null,
  latestAt: null,
  hoursSinceLast: null,
  alertAfterHours: 24,
  isStale: true,
  autoEnabled: true,
};

function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsPage identity tab (Bloco F2 mínimo)', () => {
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
      expect(mocks.updateShopSettings.mock.calls[0]?.[0]).toEqual({
        name: 'Oficina Nova',
        phone: '1133334444',
        address: 'Rua das Flores, 100',
        documentFooter: 'Obrigado!',
        timeFormat: 'H24',
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

describe('SettingsPage tabs (2026-09-18)', () => {
  beforeEach(() => {
    mocks.getShopSettings.mockReset();
    mocks.getShopSettings.mockResolvedValue(settings);
    mocks.getBackupConfig.mockReset();
    mocks.getBackupConfig.mockResolvedValue(backupConfig);
    mocks.updateBackupConfig.mockReset();
    mocks.updateBackupConfig.mockResolvedValue(backupConfig);
    mocks.createBackup.mockReset();
    mocks.createBackup.mockResolvedValue({ backup: { id: 'bk-1' } });
    mocks.getBackupStatus.mockReset();
    mocks.getBackupStatus.mockResolvedValue(backupStatus);
    mocks.seedCatalogExample.mockReset();
    mocks.seedCatalogExample.mockResolvedValue({ services: 10, products: 8, suppliers: 3 });
  });

  it('shows the four tabs with the identity one active by default', async () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'ADMIN', name: 'Ana', email: 'ana@x.com' } });

    renderPage();

    expect(screen.getByRole('tab', { name: 'Identidade da oficina' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Data e hora' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Operação' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Minha conta' })).toBeTruthy();
    expect(await screen.findByLabelText(/Nome da oficina/)).toHaveProperty(
      'value',
      'Auto Center DL',
    );
  });

  it('hides the admin-only operations content for non-admins', async () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'MECHANIC' } });

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Operação' }));

    expect(await screen.findByText(/exclusiva do administrador/)).toBeTruthy();
    expect(mocks.getBackupConfig).not.toHaveBeenCalled();
  });

  it('loads backup config/status and saves changes (admin)', async () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'ADMIN' } });

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Operação' }));

    expect(await screen.findByText('Nenhum backup ainda.')).toBeTruthy();
    const interval = await screen.findByLabelText('Intervalo (horas)');
    expect(interval).toHaveProperty('value', '24');

    await userEvent.clear(interval);
    await userEvent.type(interval, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar backup' }));

    await waitFor(() => {
      expect(mocks.updateBackupConfig.mock.calls[0]?.[0]).toEqual({
        autoEnabled: true,
        intervalHours: 12,
        keep: 14,
        alertAfterHours: 24,
      });
    });
    expect(await screen.findByText('Configurações de backup salvas.')).toBeTruthy();
  });

  it('creates a manual backup on demand', async () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'ADMIN' } });

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Operação' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Fazer backup agora' }));

    expect(await screen.findByText('Backup criado com sucesso.')).toBeTruthy();
    expect(mocks.createBackup).toHaveBeenCalledTimes(1);
  });

  it('loads the example catalog from the operations tab', async () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'ADMIN' } });

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Operação' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Carregar catálogo de exemplo' }),
    );

    expect(
      await screen.findByText('Catálogo de exemplo carregado (10 serviços, 8 produtos, 3 fornecedores).'),
    ).toBeTruthy();
  });

  it('shows the signed-in user and a change-password link on the account tab', async () => {
    mocks.useAuth.mockReturnValue({
      user: { role: 'ADMIN', name: 'Ana Admin', email: 'ana@oficina.local' },
    });

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Minha conta' }));

    expect(await screen.findByText('Ana Admin')).toBeTruthy();
    expect(screen.getByText(/Papel: Administrador/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Alterar minha senha' })).toBeTruthy();
  });

  it('rejects an out-of-range backup interval', async () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'ADMIN' } });

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Operação' }));

    const interval = await screen.findByLabelText('Intervalo (horas)');
    await userEvent.clear(interval);
    await userEvent.type(interval, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar backup' }));

    expect(await screen.findByText(/Intervalo deve ser um número inteiro entre 1 e 168/)).toBeTruthy();
    expect(mocks.updateBackupConfig).not.toHaveBeenCalled();
  });
});

describe('SettingsPage data/time tab (2026-09-18)', () => {
  beforeEach(() => {
    mocks.getShopSettings.mockReset();
    mocks.updateShopSettings.mockReset();
    mocks.getShopSettings.mockResolvedValue(settings);
    mocks.updateShopSettings.mockResolvedValue(settings);
  });

  it('switches the app-wide time format without touching the other fields', async () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'ADMIN' } });

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Data e hora' }));

    const h24 = await screen.findByRole('radio', { name: /24 horas/ });
    const h12 = screen.getByRole('radio', { name: /12 horas/ });
    expect(h24).toHaveProperty('checked', true);
    await userEvent.click(h12);
    expect(h12).toHaveProperty('checked', true);

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(mocks.updateShopSettings.mock.calls[0]?.[0]).toEqual({
        name: 'Auto Center DL',
        phone: '1133334444',
        address: 'Rua das Flores, 100',
        documentFooter: 'Obrigado!',
        timeFormat: 'H12',
      });
    });
    expect(await screen.findByText('Configurações salvas.')).toBeTruthy();
  });

  it('keeps the time format selector out of the identity tab', async () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'ADMIN' } });

    renderPage();

    expect(await screen.findByLabelText(/Nome da oficina/)).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Formato de data e hora' })).toBeNull();
  });

  it('blocks editing for ATTENDANT on the data/time tab', async () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'ATTENDANT' } });

    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Data e hora' }));

    const radios = await screen.findAllByRole('radio');
    expect(radios[0]).toHaveProperty('disabled', true);
    expect(radios[1]).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    expect(screen.getByText(/Somente administradores/)).toBeTruthy();
  });
});