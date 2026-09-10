import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsService } from '../src/modules/reports/reports.service';

interface SnapshotServiceItem {
  unitPriceCents: number;
  quantity: number;
  serviceName: string;
}

interface SnapshotProductItem {
  unitPriceCents: number;
  quantity: number;
  discountCents: number;
  productName: string;
}

interface DeliveredFixture {
  id: string;
  serviceItems: SnapshotServiceItem[];
  productItems: SnapshotProductItem[];
  pickup: { createdAt: Date };
  updatedAt: Date;
}

function makeDelivered(overrides: Partial<DeliveredFixture> = {}): DeliveredFixture {
  return {
    id: 'wo_1',
    serviceItems: [
      { serviceName: 'Troca de óleo', unitPriceCents: 20000, quantity: 1 },
      { serviceName: 'Balanceamento', unitPriceCents: 15000, quantity: 2 },
    ],
    productItems: [
      { productName: 'Filtro de óleo', unitPriceCents: 3500, quantity: 2, discountCents: 500 },
      { productName: 'Óleo 5W30', unitPriceCents: 4500, quantity: 1, discountCents: 0 },
    ],
    pickup: { createdAt: new Date('2026-09-01T13:00:00') },
    updatedAt: new Date('2026-09-01T13:00:00'),
    ...overrides,
  };
}

describe('ReportsService', () => {
  let analyticsRepo: {
    listDeliveredWorkOrders: ReturnType<typeof vi.fn>;
    workOrderCountByStatus: ReturnType<typeof vi.fn>;
  };
  let service: ReportsService;

  beforeEach(() => {
    analyticsRepo = {
      listDeliveredWorkOrders: vi.fn(),
      workOrderCountByStatus: vi.fn(),
    };
    service = new ReportsService(analyticsRepo as never);
  });

  it('builds the daily revenue report grouped by delivery date', async () => {
    analyticsRepo.listDeliveredWorkOrders.mockResolvedValue([
      makeDelivered(),
      makeDelivered({ id: 'wo_2', pickup: { createdAt: new Date('2026-09-02T10:00:00') } }),
      makeDelivered({ id: 'wo_3', pickup: { createdAt: new Date('2026-09-02T18:00:00') } }),
    ]);

    const report = await service.revenue({});

    // Per order: services 20000 + 30000 = 50000; products 7000 − 500 + 4500 = 11000.
    // Total per order = 61000. Two orders on 09-02 → 122000.
    expect(report.items).toHaveLength(2);
    expect(report.items[0]).toMatchObject({
      date: '2026-09-01',
      workOrderCount: 1,
      servicesCents: 50000,
      productsCents: 11000,
      discountsCents: 500,
      totalCents: 61000,
    });
    expect(report.items[1]).toMatchObject({
      date: '2026-09-02',
      workOrderCount: 2,
      totalCents: 122000,
    });
    expect(report.totalCents).toBe(183000);
  });

  it('ranks top services by snapshot revenue, descending, capped by limit', async () => {
    analyticsRepo.listDeliveredWorkOrders.mockResolvedValue([
      makeDelivered(),
      makeDelivered({
        serviceItems: [
          { serviceName: 'Troca de óleo', unitPriceCents: 20000, quantity: 3 },
          { serviceName: 'Alinhamento', unitPriceCents: 9000, quantity: 1 },
        ],
      }),
    ]);

    const report = await service.topServices({ limit: 2 });

    expect(report.items).toEqual([
      { name: 'Troca de óleo', quantity: 4, revenueCents: 80000 },
      { name: 'Balanceamento', quantity: 2, revenueCents: 30000 },
    ]);
  });

  it('ranks top products applying per-line discounts', async () => {
    analyticsRepo.listDeliveredWorkOrders.mockResolvedValue([makeDelivered()]);

    const report = await service.topProducts({ limit: 10 });

    expect(report.items).toEqual([
      { name: 'Filtro de óleo', quantity: 2, revenueCents: 6500 },
      { name: 'Óleo 5W30', quantity: 1, revenueCents: 4500 },
    ]);
  });

  it('fills every status with a zero count in enum order', async () => {
    analyticsRepo.workOrderCountByStatus.mockResolvedValue([
      { status: 'OPEN', _count: 3 },
      { status: 'DELIVERED', _count: 7 },
    ]);

    const report = await service.workOrderStatus({});

    expect(report.items).toHaveLength(10);
    expect(report.items[0]).toEqual({ status: 'OPEN', count: 3 });
    expect(report.items.find((item) => item.status === 'DELIVERED')).toEqual({
      status: 'DELIVERED',
      count: 7,
    });
    expect(report.items.find((item) => item.status === 'CANCELLED')).toEqual({
      status: 'CANCELLED',
      count: 0,
    });
  });
});