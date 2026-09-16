import { z } from 'zod';
import { MAX_SAFE_CENTS } from '@mechanic-system/shared';
import { PAYMENT_METHODS } from '@mechanic-system/types';
import { idSchema } from './common';

/**
 * Payment schemas (Bloco A — now uses the shared method enum from types).
 * Amounts are integer cents (spec §18); the API validates the balance
 * server-side — the client never decides how much can be paid.
 */

export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const createPaymentSchema = z
  .object({
    amountCents: z
      .number({ invalid_type_error: 'Valor deve ser um número' })
      .int('Valor deve ser em centavos (inteiro)')
      .min(1, 'Valor deve ser maior que zero')
      .max(MAX_SAFE_CENTS),
    method: paymentMethodSchema,
    notes: z.string().trim().max(255).optional().or(z.literal('')),
  })
  .strict();
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

/** Route param schemas for /work-orders/:workOrderId/payments/:paymentId. */
export const paymentIdSchema = idSchema;
