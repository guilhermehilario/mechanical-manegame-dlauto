import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './dashboard-page';
import type { DashboardSummaryDto } from '@mechanic-system/types';

const mocks = vi.hoisted(() => ({
  getDashboardSummary: vi.fn(),
  getBackupStatus: vi.fn(),
}));

vi.mock('../../services/dashboard.service', () => ({
  getDashboardSummary: mocks.getDashboardSummary,
}));

vi.mock('../../services/backup-status.service', () => ({
  getBackupStatus: mocks.getBackupStatus,
}));

const summary: DashboardSummaryDto = {
  counts: {
    customers: 42,
    activeWorkOrders: 7,
    awaitingPickup: 3,
    todayAppointments: 5,
    lowStockProducts: 2,
  },
  revenue: {
    currentMonthCents: 125000,
    previousMonthCents: 90000,
  },
  cash: {
    todayCents: 15000,
    monthCents: 100000,
  },
  paymentMethods: [
    { method: 'PIX', count: 2, totalCents: 3000 },
    { method: 'CASH', count: 1, totalCents: 1000 },
  ],
  workOrdersByStatus: [
    { status: 'OPEN', count: 4 },
    { status: 'AWAITING_PICKUP', count: 3 },
  ],
  upcomingAppointments: [
    {
      id: 'apt_1',
      customerId: 'cus_1',
      customerName: 'João da Silva',
      vehicleId: 'veh_1',
      vehiclePlate: 'ABC1D23',
      serviceId: 'svc_1',
      serviceName: 'Troca de óleo',
      scheduledAt: '2026-09-10T14:00:00.000Z',
      status: 'SCHEDULED',
      notes: null,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
  ],
  recentWorkOrders: [
    {
      id: 'wo_1',
      orderNumber: 1000,
      customerId: 'cus_1',
      customerName: 'João da Silva',
      vehicleId: 'veh_1',
      vehiclePlate: 'ABC1D23',
      vehicleModel: 'Volkswagen Gol',
      status: 'AWAITING_PICKUP',
      notes: null,
      approvedAt: null,
      completedAt: null,
      totals: { servicesCents: 10000, productsCents: 5000, discountsCents: 0, totalCents: 15000 },
      serviceItems: [],
      productItems: [],
      payment: null,
      createdAt: '2026-09-10T10:00:00.000Z',
      updatedAt: '2026-09-10T10:00:00.000Z',
    },
  ],
  lowStockProducts: [
    { id: 'prd_1', code: 'FIL-001', name: 'Filtro de óleo', stockQuantity: 1, minStock: 3 },
  ],
};

function renderPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear();
    // Banner hidden by default (fresh/absent status) — no noise in these tests.
    mocks.getBackupStatus.mockResolvedValue({
      latest: null,
      latestAt: null,
      hoursSinceLast: null,
      alertAfterHours: 24,
      isStale: false,
      autoEnabled: true,
    });
  });

  it('renders KPIs, revenue and supporting lists', async () => {
    mocks.getDashboardSummary.mockResolvedValue(summary);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByText('Clientes')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('OS ativas')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getAllByText('R$ 1.250,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 900,00').length).toBeGreaterThan(0);
    expect(screen.getByText('João da Silva')).toBeTruthy();
    expect(screen.getByText('Filtro de óleo')).toBeTruthy();
  });

  it('shows the loading state first', () => {
    mocks.getDashboardSummary.mockImplementation(() => new Promise(() => undefined));

    renderPage();

    expect(screen.getByText('Carregando…')).toBeTruthy();
  });

  it('shows an error message when the API fails', async () => {
    mocks.getDashboardSummary.mockRejectedValue(new Error('boom'));

    renderPage();

    expect(
      await screen.findByText('Não foi possível carregar o painel.'),
    ).toBeTruthy();
  });

  it('shows the backup alert banner when the latest backup is stale', async () => {
    mocks.getDashboardSummary.mockResolvedValue(summary);
    mocks.getBackupStatus.mockResolvedValue({
      latest: null,
      latestAt: null,
      hoursSinceLast: null,
      alertAfterHours: 24,
      isStale: true,
      autoEnabled: true,
    });

    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Backup dos dados atrasado/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Fazer backup agora' })).toBeTruthy();
  });

  it('hides the backup alert banner when the backup is fresh', async () => {
    mocks.getDashboardSummary.mockResolvedValue(summary);
    mocks.getBackupStatus.mockResolvedValue({
      latest: null,
      latestAt: new Date().toISOString(),
      hoursSinceLast: 1,
      alertAfterHours: 24,
      isStale: false,
      autoEnabled: true,
    });

    renderPage();

    // Give the banner query a tick to settle.
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.queryByText(/Backup dos dados atrasado/)).toBeNull();
  });

  it('shows charts by default', async () => {
    mocks.getDashboardSummary.mockResolvedValue(summary);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByText('Gráficos')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ocultar gráficos' })).toBeTruthy();
    expect(
      screen.getByLabelText('Distribuição de status das ordens de serviço'),
    ).toBeTruthy();
    expect(screen.getByText('Receita e caixa')).toBeTruthy();
    expect(screen.getByText('Competência atual')).toBeTruthy();
    expect(screen.getByText('Recebido por forma de pagamento')).toBeTruthy();
    expect(screen.getByText('Pix')).toBeTruthy();
    expect(screen.getByText('Dinheiro')).toBeTruthy();
  });

  it('hides the charts when the user toggles them off and persists the choice', async () => {
    mocks.getDashboardSummary.mockResolvedValue(summary);

    renderPage();

    await screen.findByRole('heading', { name: 'Dashboard' });
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar gráficos' }));

    expect(screen.queryByTestId('dashboard-charts')).toBeNull();
    expect(screen.getByRole('button', { name: 'Mostrar gráficos' })).toBeTruthy();
    expect(localStorage.getItem('mechanic.dashboard.hideCharts')).toBe('1');
  });

  it('keeps the charts hidden on reload once the preference is set', async () => {
    localStorage.setItem('mechanic.dashboard.hideCharts', '1');
    mocks.getDashboardSummary.mockResolvedValue(summary);

    renderPage();

    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.queryByTestId('dashboard-charts')).toBeNull();
    expect(screen.getByRole('button', { name: 'Mostrar gráficos' })).toBeTruthy();
  });
});