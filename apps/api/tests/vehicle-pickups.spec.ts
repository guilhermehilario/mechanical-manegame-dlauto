import { describe, expect, it, vi } from 'vitest';
import { VehiclePickupsService } from '../src/modules/vehicle-pickups/vehicle-pickups.service';
import type { VehiclePickupsRepository } from '../src/modules/vehicle-pickups/vehicle-pickups.repository';
import type { WorkOrdersRepository } from '../src/modules/work-orders/work-orders.repository';
import type { PrismaService } from '../src/prisma/prisma.service';

type PickupsRepo = Pick<
  VehiclePickupsRepository,
  | 'findByWorkOrderId'
  | 'findById'
  | 'list'
  | 'count'
  | 'createInTransaction'
>;
type WorkOrdersRepo = Pick<WorkOrdersRepository, 'findById'>;

function makePickupRow(id: string) {
  return {
    id,
    workOrderId: 'wo-1',
    receiverName: 'Maria Souza',
    receiverDoc: '52998224725',
    receiverPhone: '11999998888',
    mileageKm: 45200,
    signatureData: 'data:image/png;base64,AAA',
    notes: null,
    registeredBy: 'user-1',
    createdAt: new Date('2026-01-01T12:00:00Z'),
  };
}

function makeFullRow(id: string) {
  return {
    ...makePickupRow(id),
    workOrder: {
      orderNumber: 1001,
      customer: { name: 'JoãoCliente' },
      vehicle: { plate: 'ABC1D23' },
    },
    registeredByUser: { name: 'Atendente' },
  };
}

const VALID_INPUT = {
  receiverName: 'Maria Souza',
  receiverDoc: '52998224725',
  receiverPhone: '11999998888',
  mileageKm: 45200,
  signatureData: 'data:image/png;base64,AAA',
  notes: undefined,
};

function makeService(overrides: {
  workOrder?: { status: string } | null;
  existing?: unknown;
  createdId?: string;
}) {
  const pickupsRepository: PickupsRepo = {
    findByWorkOrderId: vi.fn().mockResolvedValue(overrides.existing ?? null),
    findById: vi.fn().mockResolvedValue(makeFullRow(overrides.createdId ?? 'pk-1')),
    list: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    createInTransaction: vi.fn().mockResolvedValue(makePickupRow(overrides.createdId ?? 'pk-1')),
  };
  const workOrdersRepository: WorkOrdersRepo = {
    findById: vi
      .fn()
      .mockResolvedValue(
        overrides.workOrder === undefined ? { id: 'wo-1', status: 'AWAITING_PICKUP' } : overrides.workOrder,
      ),
  };
  const tx = {
    workOrder: { update: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(tx)),
  };
  const service = new VehiclePickupsService(
    pickupsRepository as unknown as VehiclePickupsRepository,
    workOrdersRepository as unknown as WorkOrdersRepository,
    prisma as unknown as PrismaService,
  );
  return { service, pickupsRepository, workOrdersRepository, tx, prisma };
}

describe('VehiclePickupsService.register', () => {
  it('creates the receipt and flips the OS to DELIVERED in one transaction', async () => {
    const { service, tx, pickupsRepository } = makeService({});
    const dto = await service.register('wo-1', VALID_INPUT, 'user-1');
    expect(tx.workOrder.update).toHaveBeenCalledWith({
      where: { id: 'wo-1' },
      data: { status: 'DELIVERED' },
    });
    expect(pickupsRepository.createInTransaction).toHaveBeenCalledTimes(1);
    expect(dto.orderNumber).toBe(1001);
    expect(dto.hasSignature).toBe(true);
    expect(dto.registeredByName).toBe('Atendente');
  });

  it('404s when the work order does not exist', async () => {
    const { service } = makeService({ workOrder: null });
    await expect(service.register('missing', VALID_INPUT, 'user-1')).rejects.toMatchObject({
      status: 404,
      code: 'WORK_ORDER_NOT_FOUND',
    });
  });

  it('409s when the OS is not AWAITING_PICKUP', async () => {
    const { service } = makeService({ workOrder: { status: 'IN_EXECUTION' } });
    await expect(service.register('wo-1', VALID_INPUT, 'user-1')).rejects.toMatchObject({
      status: 409,
      code: 'WORK_ORDER_NOT_AWAITING_PICKUP',
    });
  });

  it('409s when a receipt already exists (1─1, immutable)', async () => {
    const { service } = makeService({ existing: makePickupRow('pk-existing') });
    await expect(service.register('wo-1', VALID_INPUT, 'user-1')).rejects.toMatchObject({
      status: 409,
      code: 'PICKUP_ALREADY_EXISTS',
    });
  });

  it('normalizes empty optional strings to null', async () => {
    const { service, pickupsRepository } = makeService({});
    await service.register(
      'wo-1',
      { ...VALID_INPUT, receiverPhone: '', signatureData: '', notes: '', mileageKm: undefined },
      'user-1',
    );
    const arg = vi.mocked(pickupsRepository.createInTransaction).mock.calls[0]?.[1];
    expect(arg?.receiverPhone).toBeNull();
    expect(arg?.signatureData).toBeNull();
    expect(arg?.notes).toBeNull();
    expect(arg?.mileageKm).toBeNull();
  });
});
