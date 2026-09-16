import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentsService } from '../src/modules/payments/payments.service';
import type { PaymentsRepository, PaymentWithRelations } from '../src/modules/payments/payments.repository';
import type { WorkOrdersRepository, WorkOrderWithRelations } from '../src/modules/work-orders/work-orders.repository';
import type { PrismaService } from '../src/prisma/prisma.service';
import { ConflictError, NotFoundError } from '../src/common/errors/domain.error';

function makeWorkOrder(overrides: Partial<WorkOrderWithRelations> = {}): WorkOrderWithRelations {
  return {
    id: 'wo_1',
    orderNumber: 1000,
    customerId: 'cus_1',
    vehicleId: 'veh_1',
    status: 'AWAITING_PICKUP',
    notes: null,
    approvedAt: new Date(),
    completedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: { id: 'cus_1', name: 'João' },
    vehicle: { id: 'veh_1', plate: 'ABC1D23' },
    serviceItems: [{ unitPriceCents: 10000, quantity: 1 } as never],
    productItems: [{ unitPriceCents: 3500, quantity: 1, discountCents: 500 } as never],
    ...overrides,
  } as unknown as WorkOrderWithRelations;
}

function makePayment(overrides: Partial<PaymentWithRelations> = {}): PaymentWithRelations {
  return {
    id: 'pay_1',
    workOrderId: 'wo_1',
    amountCents: 5000,
    method: 'PIX',
    paidAt: new Date(),
    notes: null,
    receivedBy: 'usr_1',
    receivedByUser: { name: 'Maria' },
    createdAt: new Date(),
    ...overrides,
  } as unknown as PaymentWithRelations;
}

describe('PaymentsService', () => {
  let paymentsRepo: {
    listByWorkOrder: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    paidTotal: ReturnType<typeof vi.fn>;
    paidTotalInTransaction: ReturnType<typeof vi.fn>;
    createInTransaction: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteInTransaction: ReturnType<typeof vi.fn>;
  };
  let workOrdersRepo: { findById: ReturnType<typeof vi.fn> };
  let prisma: { $transaction: ReturnType<typeof vi.fn> };
  let service: PaymentsService;

  beforeEach(() => {
    paymentsRepo = {
      listByWorkOrder: vi.fn(),
      findById: vi.fn(),
      paidTotal: vi.fn(),
      paidTotalInTransaction: vi.fn(),
      createInTransaction: vi.fn(),
      delete: vi.fn(),
      deleteInTransaction: vi.fn(),
    };
    workOrdersRepo = { findById: vi.fn() };
    prisma = {
      $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({ auditLog: { create: vi.fn() } }),
      ),
    };
    service = new PaymentsService(
      paymentsRepo as unknown as PaymentsRepository,
      workOrdersRepo as unknown as WorkOrdersRepository,
      prisma as unknown as PrismaService,
    );
  });

  describe('create', () => {
    it('rejects when the work order does not exist', async () => {
      workOrdersRepo.findById.mockResolvedValue(null);

      await expect(
        service.create('wo_404', { amountCents: 100, method: 'CASH' }, 'usr_1'),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('rejects payments before the order is payable', async () => {
      workOrdersRepo.findById.mockResolvedValue(makeWorkOrder({ status: 'IN_EXECUTION' }));

      await expect(
        service.create('wo_1', { amountCents: 100, method: 'CASH' }, 'usr_1'),
      ).rejects.toMatchObject({ code: 'WORK_ORDER_NOT_PAYABLE' });
    });

    it('rejects an amount above the remaining balance', async () => {
      // total = 10000 + 3500 - 500 = 13000; paid 12000 → balance 1000.
      workOrdersRepo.findById.mockResolvedValue(makeWorkOrder());
      paymentsRepo.paidTotalInTransaction.mockResolvedValue(12000);

      await expect(
        service.create('wo_1', { amountCents: 1001, method: 'CASH' }, 'usr_1'),
      ).rejects.toMatchObject({ code: 'PAYMENT_EXCEEDS_BALANCE' });
    });

    it('creates the payment inside one transaction and returns the DTO', async () => {
      workOrdersRepo.findById.mockResolvedValue(makeWorkOrder());
      paymentsRepo.paidTotalInTransaction.mockResolvedValue(0);
      paymentsRepo.createInTransaction.mockResolvedValue(makePayment());
      paymentsRepo.findById.mockResolvedValue(makePayment());

      const result = await service.create(
        'wo_1',
        { amountCents: 5000, method: 'PIX', notes: 'sinal' },
        'usr_1',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(paymentsRepo.createInTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          workOrderId: 'wo_1',
          amountCents: 5000,
          method: 'PIX',
          receivedBy: 'usr_1',
          notes: 'sinal',
        }),
      );
      expect(result.payment).toMatchObject({
        id: 'pay_1',
        amountCents: 5000,
        method: 'PIX',
        receivedByName: 'Maria',
      });
      expect(result.totals.totalCents).toBe(13000);
    });

    it('normalizes empty notes to null', async () => {
      workOrdersRepo.findById.mockResolvedValue(makeWorkOrder());
      paymentsRepo.paidTotalInTransaction.mockResolvedValue(0);
      paymentsRepo.createInTransaction.mockResolvedValue(makePayment());
      paymentsRepo.findById.mockResolvedValue(makePayment());

      await service.create('wo_1', { amountCents: 100, method: 'CASH', notes: '  ' }, 'usr_1');

      expect(paymentsRepo.createInTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ notes: null }),
      );
    });
  });

  describe('listByWorkOrder', () => {
    it('returns items plus the derived summary', async () => {
      workOrdersRepo.findById.mockResolvedValue(makeWorkOrder());
      paymentsRepo.listByWorkOrder.mockResolvedValue([
        makePayment(),
        makePayment({ id: 'pay_2', amountCents: 3000 }),
      ]);

      const result = await service.listByWorkOrder('wo_1');

      expect(result.items).toHaveLength(2);
      expect(result.summary).toEqual({
        paidCents: 8000,
        balanceCents: 5000,
        status: 'PARTIAL',
      });
    });

    it('reports PAID when payments cover the total', async () => {
      workOrdersRepo.findById.mockResolvedValue(makeWorkOrder());
      paymentsRepo.listByWorkOrder.mockResolvedValue([makePayment({ amountCents: 13000 })]);

      const { summary } = await service.listByWorkOrder('wo_1');

      expect(summary).toEqual({
        paidCents: 13000,
        balanceCents: 0,
        status: 'PAID',
      });
    });
  });

  describe('refund', () => {
    it('throws when the payment does not exist', async () => {
      paymentsRepo.findById.mockResolvedValue(null);

      await expect(service.refund('pay_404', 'usr_1')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('deletes the payment row and records the audit trail in one transaction', async () => {
      paymentsRepo.findById.mockResolvedValue(makePayment());
      paymentsRepo.deleteInTransaction.mockResolvedValue(makePayment());
      const auditCreate = vi.fn();
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
        fn({ auditLog: { create: auditCreate } }),
      );

      await expect(service.refund('pay_1', 'usr_1')).resolves.toBeUndefined();
      expect(paymentsRepo.deleteInTransaction).toHaveBeenCalledWith(
        expect.anything(),
        'pay_1',
      );
      expect(auditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'usr_1',
          action: 'PAYMENT_REFUND',
          entity: 'payment',
          entityId: 'pay_1',
        }) as Record<string, unknown>,
      });
    });
  });

  describe('summary', () => {
    it('aggregates paid total in a single query', async () => {
      workOrdersRepo.findById.mockResolvedValue(makeWorkOrder());
      paymentsRepo.paidTotal.mockResolvedValue(13000);

      await expect(service.summary('wo_1')).resolves.toEqual({
        paidCents: 13000,
        balanceCents: 0,
        status: 'PAID',
      });
    });

    it('rejects when the order is not payable yet', async () => {
      workOrdersRepo.findById.mockResolvedValue(makeWorkOrder({ status: 'OPEN' }));

      await expect(service.summary('wo_1')).rejects.toBeInstanceOf(ConflictError);
    });
  });
});
