import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './dashboard-page';
import type { DashboardSummaryDto } from '@mechanic-system/types';

const mocks = vi.hoisted(() => ({
  getDashboardSummary: vi.fn(),
}));

vi.mock('../../services/dashboard.service', () => ({
  getDashboardSummary: mocks.getDashboardSummary,
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
  it('renders KPIs, revenue and supporting lists', async () => {
    mocks.getDashboardSummary.mockResolvedValue(summary);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByText('Clientes')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('OS ativas')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('R$ 1.250,00')).toBeTruthy();
    expect(screen.getByText('R$ 900,00')).toBeTruthy();
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
});