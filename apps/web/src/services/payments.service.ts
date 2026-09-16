import type { PaymentDto, CreatePaymentResultDto } from '@mechanic-system/types';
import type { CreatePaymentInput } from '@mechanic-system/validation';
import { api } from './auth.service';

export function listPayments(workOrderId: string): Promise<PaymentDto[]> {
  return api.get<PaymentDto[]>(`/work-orders/${workOrderId}/payments`);
}

export function createPayment(
  workOrderId: string,
  input: CreatePaymentInput,
): Promise<CreatePaymentResultDto> {
  return api.post<CreatePaymentResultDto>(`/work-orders/${workOrderId}/payments`, input);
}

/** Refund (storno) — ADMIN only; the API rejects other roles with 403. */
export function refundPayment(workOrderId: string, paymentId: string): Promise<unknown> {
  return api.delete(`/work-orders/${workOrderId}/payments/${paymentId}`);
}
