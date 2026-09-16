import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Product,
  Service,
  Vehicle,
  WorkOrder,
  WorkOrderProductItem,
  WorkOrderServiceItem,
} from '@prisma/client';
import { WorkOrdersService } from '../src/modules/work-orders/work-orders.service';
import type { WorkOrdersRepository, WorkOrderWithRelations } from '../src/modules/work-orders/work-orders.repository';
import type { VehiclesRepository } from '../src/modules/vehicles/vehicles.repository';
import type { ServicesRepository } from '../src/modules/services/services.repository';
import type { ProductsRepository } from '../src/modules/products/products.repository';
import type { StockService } from '../src/modules/products/stock.service';
import type { PaymentsRepository } from '../src/modules/payments/payments.repository';
import type { PrismaService } from '../src/prisma/prisma.service';

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'veh_1',
    customerId: 'cus_1',
    plate: 'ABC1D23',
    brand: 'Volkswagen',
    model: 'Gol',
    year: 2020,
    color: null,
    mileage: null,
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'svc_1',
    name: 'Troca de óleo',
    description: null,
    priceCents: 15000,
    estimatedMinutes: 40,
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prd_1',
    code: 'FIL-001',
    name: 'Filtro de óleo',
    description: null,
    costPriceCents: 2000,
    salePriceCents: 3500,
    stockQuantity: 10,
    minStock: 2,
    location: null,
    supplierId: null,
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrderWithRelations {
  const base: WorkOrder = {
    id: 'wo_1',
    orderNumber: 1000,
    customerId: 'cus_1',
    vehicleId: 'veh_1',
    status: 'OPEN',
    notes: null,
    approvedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  return {
    ...base,
    customer: { name: 'João da Silva' },
    vehicle: { plate: 'ABC1D23', brand: 'Volkswagen', model: 'Gol' },
    serviceItems: [],
    productItems: [],
  };
}

function makeServiceItem(overrides: Partial<WorkOrderServiceItem> = {}): WorkOrderServiceItem {
  return {
    id: 'svi_1',
    workOrderId: 'wo_1',
    serviceId: 'svc_1',
    serviceName: 'Troca de óleo',
    unitPriceCents: 15000,
    quantity: 1,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeProductItem(
  overrides: Partial<WorkOrderProductItem> = {},
): WorkOrderProductItem {
  return {
    id: 'pri_1',
    workOrderId: 'wo_1',
    productId: 'prd_1',
    productName: 'Filtro de óleo',
    unitPriceCents: 3500,
    quantity: 2,
    discountCents: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('WorkOrdersService', () => {
  let repo: {
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    createInTransaction: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    createServiceItemInTransaction: ReturnType<typeof vi.fn>;
    createProductItemInTransaction: ReturnType<typeof vi.fn>;
    findServiceItem: ReturnType<typeof vi.fn>;
    findProductItem: ReturnType<typeof vi.fn>;
    deleteServiceItem: ReturnType<typeof vi.fn>;
    deleteProductItem: ReturnType<typeof vi.fn>;
    deleteServiceItemInTransaction: ReturnType<typeof vi.fn>;
    deleteProductItemInTransaction: ReturnType<typeof vi.fn>;
  };
  let vehiclesRepo: { findById: ReturnType<typeof vi.fn> };
  let servicesRepo: { findById: ReturnType<typeof vi.fn> };
  let productsRepo: { findById: ReturnType<typeof vi.fn> };
  let stockService: { applyInTransaction: ReturnType<typeof vi.fn> };
  let paymentsRepo: { paidTotal: ReturnType<typeof vi.fn> };
  let service: WorkOrdersService;

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
      list: vi.fn(),
      count: vi.fn(),
      createInTransaction: vi.fn(() => Promise.resolve(makeWorkOrder())),
      update: vi.fn((_id: string, data: Partial<WorkOrder>) =>
        Promise.resolve(makeWorkOrder(data)),
      ),
      createServiceItemInTransaction: vi.fn(() => Promise.resolve(makeServiceItem())),
      createProductItemInTransaction: vi.fn(() => Promise.resolve(makeProductItem())),
      findServiceItem: vi.fn(),
      findProductItem: vi.fn(),
      deleteServiceItem: vi.fn(),
      deleteProductItem: vi.fn(),
      deleteProductItemInTransaction: vi.fn(() => Promise.resolve(makeProductItem())),
      deleteServiceItemInTransaction: vi.fn(() => Promise.resolve(makeServiceItem())),
    };
    vehiclesRepo = { findById: vi.fn() };
    servicesRepo = { findById: vi.fn() };
    productsRepo = { findById: vi.fn() };
    stockService = {
      applyInTransaction: vi.fn(() =>
        Promise.resolve({ movement: {}, product: makeProduct() }),
      ),
    };
    paymentsRepo = {
      paidTotal: vi.fn(() => Promise.resolve(0)),
    };
    service = new WorkOrdersService(
      repo as unknown as WorkOrdersRepository,
      vehiclesRepo as unknown as VehiclesRepository,
      servicesRepo as unknown as ServicesRepository,
      productsRepo as unknown as ProductsRepository,
      stockService as unknown as StockService,
      paymentsRepo as unknown as PaymentsRepository,
      {
        $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
        workOrder: { delete: vi.fn() },
      } as unknown as PrismaService,
    );
  });

  const baseInput = { customerId: 'cus_1', vehicleId: 'veh_1', notes: '' };

  it('creates a work order for an owned vehicle', async () => {
    vehiclesRepo.findById.mockResolvedValue(makeVehicle());
    repo.findById.mockResolvedValue(makeWorkOrder());

    const created = await service.create(baseInput);

    expect(created.status).toBe('OPEN');
    expect(created.totals.totalCents).toBe(0);
    expect(repo.createInTransaction).toHaveBeenCalled();
  });

  it('rejects vehicle not owned by the customer', async () => {
    vehiclesRepo.findById.mockResolvedValue(makeVehicle({ customerId: 'cus_other' }));
    await expect(service.create(baseInput)).rejects.toMatchObject({
      code: 'VEHICLE_NOT_OWNED_BY_CUSTOMER',
      status: 409,
    });
  });

  it('returns 404 for missing work order', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toMatchObject({
      code: 'WORK_ORDER_NOT_FOUND',
      status: 404,
    });
  });

  it('follows the happy-path transition chain', async () => {
    const statuses = [
      'OPEN',
      'IN_ASSESSMENT',
      'AWAITING_APPROVAL',
      'APPROVED',
      'IN_EXECUTION',
      'COMPLETED',
      'AWAITING_PICKUP',
      'DELIVERED',
    ] as const;
    for (let i = 0; i < statuses.length - 1; i += 1) {
      const from = statuses[i] as (typeof statuses)[number];
      const to = statuses[i + 1] as (typeof statuses)[number];
      repo.findById.mockResolvedValue(makeWorkOrder({ status: from }));
      await service.transition('wo_1', to);
      expect(repo.update).toHaveBeenCalledWith(
        'wo_1',
        expect.objectContaining({ status: to }),
      );
    }
  });

  it('stamps approvedAt/completedAt on the right transitions', async () => {
    repo.findById.mockResolvedValue(makeWorkOrder({ status: 'AWAITING_APPROVAL' }));
    await service.transition('wo_1', 'APPROVED');
    const approvedCall = repo.update.mock.calls[0]?.[1] as
      | { approvedAt?: Date }
      | undefined;
    expect(approvedCall?.approvedAt).toBeInstanceOf(Date);

    repo.findById.mockResolvedValue(makeWorkOrder({ status: 'IN_EXECUTION' }));
    await service.transition('wo_1', 'COMPLETED');
    const completedCall = repo.update.mock.calls[1]?.[1] as
      | { completedAt?: Date }
      | undefined;
    expect(completedCall?.completedAt).toBeInstanceOf(Date);
  });

  it('rejects illegal transitions and terminal states (409)', async () => {
    repo.findById.mockResolvedValue(makeWorkOrder({ status: 'OPEN' }));
    await expect(service.transition('wo_1', 'DELIVERED')).rejects.toMatchObject({
      code: 'INVALID_WORK_ORDER_TRANSITION',
      status: 409,
    });

    repo.findById.mockResolvedValue(makeWorkOrder({ status: 'DELIVERED' }));
    await expect(service.transition('wo_1', 'OPEN')).rejects.toMatchObject({
      code: 'INVALID_WORK_ORDER_TRANSITION',
      status: 409,
    });
  });

  it('adds a service item with catalog snapshot', async () => {
    repo.findById.mockResolvedValue(makeWorkOrder({ status: 'OPEN' }));
    servicesRepo.findById.mockResolvedValue(makeService());

    await service.addServiceItem('wo_1', { serviceId: 'svc_1', quantity: 2 });

    expect(repo.createServiceItemInTransaction).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        serviceName: 'Troca de óleo', // snapshot
        unitPriceCents: 15000, // snapshot
        quantity: 2,
      }),
    );
  });

  it('blocks item edits once the quote is sent (409 ITEMS_LOCKED)', async () => {
    repo.findById.mockResolvedValue(makeWorkOrder({ status: 'AWAITING_APPROVAL' }));
    await expect(
      service.addServiceItem('wo_1', { serviceId: 'svc_1', quantity: 1 }),
    ).rejects.toMatchObject({ code: 'WORK_ORDER_ITEMS_LOCKED', status: 409 });
  });

  it('adds a product item and reserves stock in one transaction', async () => {
    repo.findById.mockResolvedValue(makeWorkOrder({ status: 'OPEN' }));
    productsRepo.findById.mockResolvedValue(makeProduct());

    await service.addProductItem('wo_1', { productId: 'prd_1', quantity: 2, discountCents: 0 }, 'usr_1');

    expect(stockService.applyInTransaction).toHaveBeenCalledWith(
      {},
      'usr_1',
      expect.objectContaining({ type: 'OUT', quantity: 2 }),
    );
    expect(repo.createProductItemInTransaction).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        productName: 'Filtro de óleo', // snapshot
        unitPriceCents: 3500, // snapshot (sale price)
      }),
    );
  });

  it('rolls back the item when stock is insufficient', async () => {
    repo.findById.mockResolvedValue(makeWorkOrder({ status: 'OPEN' }));
    productsRepo.findById.mockResolvedValue(makeProduct({ stockQuantity: 1 }));
    stockService.applyInTransaction.mockRejectedValue(
      Object.assign(new Error('Estoque insuficiente'), { code: 'INSUFFICIENT_STOCK', status: 409 }),
    );

    await expect(
      service.addProductItem('wo_1', { productId: 'prd_1', quantity: 5, discountCents: 0 }, 'usr_1'),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
  });

  it('removing a product item returns the reserved stock (IN movement)', async () => {
    repo.findById.mockResolvedValue(makeWorkOrder({ status: 'OPEN' }));
    repo.findProductItem.mockResolvedValue(makeProductItem());

    await service.removeProductItem('wo_1', 'pri_1', 'usr_1');

    expect(stockService.applyInTransaction).toHaveBeenCalledWith(
      {},
      'usr_1',
      expect.objectContaining({ type: 'IN', quantity: 2 }),
    );
    expect(repo.deleteProductItemInTransaction).toHaveBeenCalledWith({}, 'pri_1');
  });

  it('computes totals from snapshots with discounts', async () => {
    repo.findById.mockResolvedValue({
      ...makeWorkOrder(),
      serviceItems: [makeServiceItem({ unitPriceCents: 15000, quantity: 1 })],
      productItems: [makeProductItem({ unitPriceCents: 3500, quantity: 2, discountCents: 1000 })],
    });

    const result = await service.getById('wo_1');

    expect(result.totals.servicesCents).toBe(15000);
    expect(result.totals.productsCents).toBe(6000); // 3500*2 - 1000
    expect(result.totals.discountsCents).toBe(1000);
    expect(result.totals.totalCents).toBe(21000);
  });
});
