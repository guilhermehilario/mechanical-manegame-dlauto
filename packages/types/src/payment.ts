/**
 * Payment DTOs (Bloco A — docs/todo-mvp.md). A work order can receive
 * multiple partial payments; money is integer cents (§18).
 *
 * `PAYMENT_METHODS` is defined here because every package (validation,
 * shared UI) may depend on types, but types must never depend on validation
 * (dependency direction: shared → types → validation).
 */

export const PAYMENT_METHODS = [
  'CASH',
  'PIX',
  'DEBIT_CARD',
  'CREDIT_CARD',
  'TRANSFER',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface PaymentDto {
  id: string;
  workOrderId: string;
  amountCents: number;
  method: PaymentMethod;
  paidAt: string;
  notes: string | null;
  receivedByName: string | null;
  createdAt: string;
}

export interface CreatePaymentResultDto {
  payment: PaymentDto;
}

/** Financial state of one work order, derived from its payments. */
export type WorkOrderPaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface WorkOrderPaymentSummaryDto {
  paidCents: number;
  balanceCents: number;
  status: WorkOrderPaymentStatus;
}
