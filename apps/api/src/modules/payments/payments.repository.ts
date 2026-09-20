import { Injectable } from '@nestjs/common';
import type { Prisma, Payment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Payment row with the display relation (who received the money). */
export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: { receivedByUser: { select: { name: true } } };
}>;

/**
 * Data access for payments (Bloco A). No business rules here — balance
 * checks live in the service; this class only reads/writes rows.
 */
@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByWorkOrder(workOrderId: string): Promise<PaymentWithRelations[]> {
    return this.prisma.payment.findMany({
      where: { workOrderId },
      orderBy: { paidAt: 'desc' },
      include: PAYMENT_INCLUDE,
    });
  }

  findById(id: string): Promise<PaymentWithRelations | null> {
    return this.prisma.payment.findFirst({ where: { id }, include: PAYMENT_INCLUDE });
  }

  /** Sum of all payments received for the work order (single aggregate). */
  paidTotal(workOrderId: string): Promise<number> {
    return this.prisma.payment
      .aggregate({ where: { workOrderId }, _sum: { amountCents: true } })
      .then((result) => result._sum.amountCents ?? 0);
  }

  /**
   * Paid sums for MANY orders in one grouped aggregate — the list-page badge
   * (Bloco A) needs paid/total per row; one query avoids the N+1 of an
   * aggregate per work order.
   */
  async paidTotalsByWorkOrder(workOrderIds: string[]): Promise<Map<string, number>> {
    if (workOrderIds.length === 0) return new Map();
    const rows = await this.prisma.payment.groupBy({
      by: ['workOrderId'],
      where: { workOrderId: { in: workOrderIds } },
      _sum: { amountCents: true },
    });
    return new Map(rows.map((row) => [row.workOrderId, row._sum.amountCents ?? 0]));
  }

  /** Sum inside the caller's transaction (balance check + insert atomicity). */
  paidTotalInTransaction(tx: Prisma.TransactionClient, workOrderId: string): Promise<number> {
    return tx.payment
      .aggregate({ where: { workOrderId }, _sum: { amountCents: true } })
      .then((result) => result._sum.amountCents ?? 0);
  }

  createInTransaction(
    tx: Prisma.TransactionClient,
    data: {
      workOrderId: string;
      amountCents: number;
      method: Payment['method'];
      paidAt: Date;
      notes: string | null;
      receivedBy: string | null;
    },
  ): Promise<Payment> {
    return tx.payment.create({ data });
  }

  /** Delete inside the caller's transaction (refund + audit trail atomicity). */
  deleteInTransaction(tx: Prisma.TransactionClient, id: string): Promise<Payment> {
    return tx.payment.delete({ where: { id } });
  }
}

const PAYMENT_INCLUDE = {
  receivedByUser: { select: { name: true } },
};
