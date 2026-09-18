import { z } from 'zod';
import { WorkOrderStatus } from '@mechanic-system/shared';
import { createSortQuerySchema, idSchema, type SortField } from './common';

/**
 * Work order schemas (Fase 5). Items reference catalog entries; the API
 * copies name/price at insert time (snapshot, spec §35) — the client never
 * sends prices.
 */

export const createWorkOrderSchema = z
  .object({
    customerId: idSchema,
    vehicleId: idSchema,
    notes: z.string().trim().max(2000).optional().or(z.literal('')),
  })
  .strict();

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;

export const updateWorkOrderSchema = z
  .object({
    notes: z.string().trim().max(2000).optional().or(z.literal('')),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'pelo menos um campo deve ser enviado',
  });

export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>;

/** Add a service item (snapshot is taken from the catalog server-side). */
export const addServiceItemSchema = z
  .object({
    serviceId: idSchema,
    quantity: z
      .number({ invalid_type_error: 'Quantidade deve ser um número' })
      .int('Quantidade deve ser inteira')
      .min(1, 'Quantidade deve ser ao menos 1')
      .max(999)
      .default(1),
  })
  .strict();

export type AddServiceItemInput = z.infer<typeof addServiceItemSchema>;

/**
 * Add a product item: reserves (OUT movement) the stock inside the same
 * transaction that inserts the snapshot row (spec §36).
 */
export const addProductItemSchema = z
  .object({
    productId: idSchema,
    quantity: z
      .number({ invalid_type_error: 'Quantidade deve ser um número' })
      .int('Quantidade deve ser inteira')
      .min(1, 'Quantidade deve ser ao menos 1')
      .max(999),
    discountCents: z
      .number({ invalid_type_error: 'Desconto deve ser um número' })
      .int('Desconto deve ser em centavos (inteiro)')
      .min(0, 'Desconto não pode ser negativo')
      .max(900_000_000_00)
      .default(0),
  })
  .strict();

export type AddProductItemInput = z.infer<typeof addProductItemSchema>;

export const workOrderStatusBodySchema = z.object({
  status: WorkOrderStatus,
});
export type WorkOrderStatusBody = z.infer<typeof workOrderStatusBodySchema>;

/** Sortable columns for the work orders listing (whitelist — only real
 * DB columns; `openedAt`/`totalCents` are derived, not stored). */
export const WORK_ORDER_SORT_FIELDS = ['orderNumber', 'status', 'createdAt', 'updatedAt'] as const;

export const workOrderQuerySchema = createSortQuerySchema(WORK_ORDER_SORT_FIELDS).extend({
  customerId: idSchema.optional(),
  vehicleId: idSchema.optional(),
  status: WorkOrderStatus.optional(),
});

export type WorkOrderQuery = z.infer<typeof workOrderQuerySchema>;
export type WorkOrderSortField = SortField<typeof WORK_ORDER_SORT_FIELDS>;

export const workOrderIdSchema = idSchema;
export const workOrderItemIdSchema = idSchema;
