import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import {
  computeWorkOrderTotals,
  isPayableWorkOrderStatus,
} from '@mechanic-system/shared';
import type { CreatePaymentInput } from '@mechanic-system/validation';
import type {
  PaymentDto,
  WorkOrderPaymentStatus,
  WorkOrderPaymentSummaryDto,
} from '@mechanic-system/types';
import type { Payment } from '@prisma/client';
import { PaymentsRepository, type PaymentWithRelations } from './payments.repository';
import { WorkOrdersRepository } from '../work-orders/work-orders.repository';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Payable statuses (Bloco A): money can only be received when the work is
 * done or the vehicle is out — OPEN/assessment stages have no final total
 * (items are still editable).
 */


function toDto(payment: PaymentWithRelations | Payment): PaymentDto {
  const receivedByName =
    'receivedByUser' in payment ? (payment.receivedByUser?.name ?? null) : null;
  return {
    id: payment.id,
    workOrderId: payment.workOrderId,
    amountCents: payment.amountCents,
    method: payment.method,
    paidAt: payment.paidAt.toISOString(),
    notes: payment.notes,
    receivedByName,
    createdAt: payment.createdAt.toISOString(),
  };
}

function paymentStatus(totalCents: number, paidCents: number): WorkOrderPaymentStatus {
  if (paidCents <= 0) return 'UNPAID';
  if (paidCents >= totalCents) return 'PAID';
  return 'PARTIAL';
}

/**
 * Payment rules (Bloco A — docs/todo-mvp.md):
 *  - only COMPLETED/AWAITING_PICKUP/DELIVERED orders receive payments
 *    (before that the total is still moving — 409 WORK_ORDER_NOT_PAYABLE);
 *  - the sum of payments can never exceed the order total — the balance
 *    check and the insert share ONE transaction so two concurrent receipts
 *    cannot overpay (spec §36 pattern, SQLite single-writer);
 *  - reversal (delete) is a business decision: the controller restricts it
 *    to ADMIN/MANAGER and the audit trail records who did it.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly workOrdersRepository: WorkOrdersRepository,
    private readonly prisma: PrismaService,
  ) {}

  private async assertPayable(workOrderId: string) {
    const workOrder = await this.workOrdersRepository.findById(workOrderId);
    if (!workOrder) {
      throw new NotFoundError(ErrorCodes.WORK_ORDER_NOT_FOUND, 'Ordem de Serviço não encontrada');
    }
    if (!isPayableWorkOrderStatus(workOrder.status)) {
      throw new ConflictError(
        ErrorCodes.WORK_ORDER_NOT_PAYABLE,
        'Pagamentos são recebidos apenas em OS Concluída, Aguardando Retirada ou Entregue',
      );
    }
    const totals = computeWorkOrderTotals(workOrder.serviceItems, workOrder.productItems);
    return { workOrder, totals };
  }

  async create(
    workOrderId: string,
    input: CreatePaymentInput,
    userId: string,
  ): Promise<CreatePaymentResult> {
    const { totals } = await this.assertPayable(workOrderId);

    const created = await this.prisma.$transaction(async (tx) => {
      const paidCents = await this.paymentsRepository.paidTotalInTransaction(tx, workOrderId);
      const balanceCents = totals.totalCents - paidCents;
      if (input.amountCents > balanceCents) {
        throw new ConflictError(
          ErrorCodes.PAYMENT_EXCEEDS_BALANCE,
          `Pagamento excede o saldo devedor (saldo: ${balanceCents} centavos)`,
        );
      }
      return this.paymentsRepository.createInTransaction(tx, {
        workOrderId,
        amountCents: input.amountCents,
        method: input.method,
        paidAt: new Date(),
        notes: input.notes && input.notes.trim().length > 0 ? input.notes.trim() : null,
        receivedBy: userId,
      });
    });

    const payment = await this.paymentsRepository.findById(created.id);
    if (!payment) {
      throw new NotFoundError(ErrorCodes.PAYMENT_NOT_FOUND, 'Pagamento não encontrado');
    }
    return { payment: toDto(payment), totals };
  }

  async listByWorkOrder(workOrderId: string): Promise<PaymentsList> {
    const { totals } = await this.assertPayable(workOrderId);
    const payments = await this.paymentsRepository.listByWorkOrder(workOrderId);
    const paidCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    return {
      items: payments.map(toDto),
      totals,
      summary: {
        paidCents,
        balanceCents: Math.max(0, totals.totalCents - paidCents),
        status: paymentStatus(totals.totalCents, paidCents),
      },
    };
  }

  /**
   * Reversal (estorno): removes the payment row and records the audit trail
   * (A2 — docs/todo-mvp.md). ADMIN/MANAGER only — enforced by the controller;
   * the caller passes who acted for the audit. The route carries the work
   * order id and the payment must belong to it — a mismatch is reported as a
   * plain not-found so we never reveal a foreign payment's existence.
   */
  async refund(paymentId: string, workOrderId: string, actingUserId: string): Promise<void> {
    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment || payment.workOrderId !== workOrderId) {
      throw new NotFoundError(ErrorCodes.PAYMENT_NOT_FOUND, 'Pagamento não encontrado');
    }
    await this.prisma.$transaction(async (tx) => {
      await this.paymentsRepository.deleteInTransaction(tx, paymentId);
      await tx.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'PAYMENT_REFUND',
          entity: 'payment',
          entityId: paymentId,
          metadata: JSON.stringify({
            workOrderId: payment.workOrderId,
            amountCents: payment.amountCents,
            method: payment.method,
          }),
        },
      });
    });
  }

  /** Summary only (badge on lists/dashboard) without loading every row. */
  async summary(workOrderId: string): Promise<WorkOrderPaymentSummaryDto> {
    const { totals } = await this.assertPayable(workOrderId);
    const paidCents = await this.paymentsRepository.paidTotal(workOrderId);
    return {
      paidCents,
      balanceCents: Math.max(0, totals.totalCents - paidCents),
      status: paymentStatus(totals.totalCents, paidCents),
    };
  }
}

export interface CreatePaymentResult {
  payment: PaymentDto;
  totals: { servicesCents: number; productsCents: number; discountsCents: number; totalCents: number };
}

export interface PaymentsList {
  items: PaymentDto[];
  totals: { servicesCents: number; productsCents: number; discountsCents: number; totalCents: number };
  summary: WorkOrderPaymentSummaryDto;
}
