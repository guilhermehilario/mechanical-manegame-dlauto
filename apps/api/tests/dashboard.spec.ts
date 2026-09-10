import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import type { AppointmentDto, WorkOrderDto } from '@mechanic-system/types';

function makeAppointment(overrides: Partial<AppointmentDto> = {}): AppointmentDto {
  return {
    id: 'apt_1',
    customerId: 'cus_1',
    customerName: 'João da Silva',
    vehicleId: 'veh_1',
    vehiclePlate: 'ABC1D23',
    serviceId: 'svc_1',
    serviceName: 'Troca de óleo',
    scheduledAt: new Date().toISOString(),
    status: 'SCHEDULED',
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeWorkOrder(overrides: Partial<WorkOrderDto> = {}): WorkOrderDto {
  return {
    id: 'wo_1',
    orderNumber: 1000,
    customerId: 'cus_1',
    customerName: 'João da Silva',
    vehicleId: 'veh_1',
    vehiclePlate: 'ABC1D23',
    vehicleModel: 'Volkswagen Gol',
    status: 'OPEN',
    notes: null,
    approvedAt: null,
    completedAt: null,
    totals: { servicesCents: 0, productsCents: 0, discountsCents: 0, totalCents: 0 },
    serviceItems: [],
    productItems: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDelivered(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wo_del_1',
    serviceItems: [{ unitPriceCents: 5000, quantity: 2 }],
    productItems: [{ unitPriceCents: 3500, quantity: 1, discountCents: 500 }],
    pickup: { createdAt: new Date('2026-09-01T13:00:00') },
    updatedAt: new Date('2026-09-01T15:00:00'),
    ...overrides,
  };
}

function makeLowStockProduct() {
  return {
    id: 'prd_1',
    code: 'FIL-001',
    name: 'Filtro de óleo',
    stockQuantity: 1,
    minStock: 3,
  };
}

describe('DashboardService', () => {
  let analyticsRepo: {
    countActiveWorkOrders: ReturnType<typeof vi.fn>;
    countAwaitingPickup: ReturnType<typeof vi.fn>;
    workOrderCountByStatus: ReturnType<typeof vi.fn>;
    listDeliveredWorkOrders: ReturnType<typeof vi.fn>;
  };
  let appointmentsRepo: { countActiveBetween: ReturnType<typeof vi.fn> };
  let appointmentsService: { list: ReturnType<typeof vi.fn> };
  let workOrdersService: { list: ReturnType<typeof vi.fn> };
  let productsRepo: { count: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn> };
  let customersRepo: { count: ReturnType<typeof vi.fn> };
  let service: DashboardService;

  beforeEach(() => {
    analyticsRepo = {
      countActiveWorkOrders: vi.fn(),
      countAwaitingPickup: vi.fn(),
      workOrderCountByStatus: vi.fn(),
      listDeliveredWorkOrders: vi.fn(),
    };
    appointmentsRepo = { countActiveBetween: vi.fn() };
    appointmentsService = { list: vi.fn() };
    workOrdersService = { list: vi.fn() };
    productsRepo = { count: vi.fn(), list: vi.fn() };
    customersRepo = { count: vi.fn() };
    service = new DashboardService(
      analyticsRepo as never,
      appointmentsRepo as never,
      appointmentsService as never,
      workOrdersService as never,
      productsRepo as never,
      customersRepo as never,
    );
  });

  it('aggregates all counters and revenue buckets', async () => {
    customersRepo.count.mockResolvedValue(120);
    analyticsRepo.countActiveWorkOrders.mockResolvedValue(8);
    analyticsRepo.countAwaitingPickup.mockResolvedValue(3);
    appointmentsRepo.countActiveBetween.mockResolvedValue(5);
    productsRepo.count.mockResolvedValue(2);
    // Current month: one delivered OS (R$ 100,00 de serviços) → 10000 cents.
    analyticsRepo.listDeliveredWorkOrders.mockResolvedValueOnce([
      makeDelivered({ productItems: [] }),
    ]);
    // Previous month: nothing delivered.
    analyticsRepo.listDeliveredWorkOrders.mockResolvedValueOnce([]);
    analyticsRepo.workOrderCountByStatus.mockResolvedValue([
      { status: 'OPEN', _count: 4 },
      { status: 'AWAITING_PICKUP', _count: 3 },
    ]);
    workOrdersService.list.mockResolvedValue({
      items: [makeWorkOrder({ status: 'AWAITING_PICKUP' })],
      page: 1,
      limit: 5,
      total: 1,
      totalPages: 1,
    });
    appointmentsService.list.mockResolvedValue({
      items: [makeAppointment({ status: 'SCHEDULED' })],
      page: 1,
      limit: 12,
      total: 1,
      totalPages: 1,
    });
    productsRepo.list.mockResolvedValue([makeLowStockProduct()]);

    const summary = await service.summary();

    expect(summary.counts).toEqual({
      customers: 120,
      activeWorkOrders: 8,
      awaitingPickup: 3,
      todayAppointments: 5,
      lowStockProducts: 2,
    });
    expect(summary.revenue.currentMonthCents).toBe(10000);
    expect(summary.revenue.previousMonthCents).toBe(0);
    expect(summary.workOrdersByStatus).toEqual([
      { status: 'OPEN', count: 4 },
      { status: 'AWAITING_PICKUP', count: 3 },
    ]);
    expect(summary.recentWorkOrders).toHaveLength(1);
    expect(summary.lowStockProducts).toMatchObject([{ code: 'FIL-001' }]);
  });

  it('keeps only active appointments in the upcoming list', async () => {
    analyticsRepo.countActiveWorkOrders.mockResolvedValue(0);
    analyticsRepo.countAwaitingPickup.mockResolvedValue(0);
    appointmentsRepo.countActiveBetween.mockResolvedValue(0);
    productsRepo.count.mockResolvedValue(0);
    analyticsRepo.listDeliveredWorkOrders.mockResolvedValue([]);
    analyticsRepo.workOrderCountByStatus.mockResolvedValue([]);
    workOrdersService.list.mockResolvedValue({
      items: [],
      page: 1,
      limit: 5,
      total: 0,
      totalPages: 1,
    });
    appointmentsService.list.mockResolvedValue({
      items: [
        makeAppointment({ status: 'SCHEDULED', id: 'a1' }),
        makeAppointment({ status: 'IN_PROGRESS', id: 'a2' }),
        makeAppointment({ status: 'COMPLETED', id: 'a3' }),
        makeAppointment({ status: 'CANCELLED', id: 'a4' }),
      ],
      page: 1,
      limit: 12,
      total: 4,
      totalPages: 1,
    });
    productsRepo.list.mockResolvedValue([]);

    const summary = await service.summary();

    expect(summary.upcomingAppointments.map((apt) => apt.id)).toEqual(['a1', 'a2']);
  });
});