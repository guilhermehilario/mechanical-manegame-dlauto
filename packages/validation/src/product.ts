import { z } from 'zod';
import { idSchema, paginationQuerySchema } from './common';

/**
 * Product + stock movement schemas (Fase 3).
 * Prices are integer cents (spec §18). Stock quantity is an integer ≥ 0
 * (pieces/units); fractional units are intentionally out of scope.
 */

const priceCentsSchema = z
  .number({ invalid_type_error: 'Preço deve ser um número' })
  .int('Preço deve ser informado em centavos (inteiro)')
  .min(0, 'Preço não pode ser negativo')
  .max(900_000_000_00, 'Preço acima do limite seguro');

/** Product code: letters/digits/dashes, 2–32 chars, stored uppercase. */
export const productCodeSchema = z
  .string()
  .trim()
  .min(2, 'Código muito curto')
  .max(32)
  .transform((code) => code.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
  .refine((code) => code.length >= 2, { message: 'Código deve ter letras/números/hífen' });

export const createProductSchema = z.object({
  code: productCodeSchema,
  name: z.string().trim().min(2, 'Nome muito curto').max(120),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  costPriceCents: priceCentsSchema,
  salePriceCents: priceCentsSchema,
  stockQuantity: z
    .number({ invalid_type_error: 'Estoque deve ser um número' })
    .int('Estoque deve ser inteiro')
    .min(0, 'Estoque não pode ser negativo')
    .max(1_000_000)
    .default(0),
  minStock: z
    .number({ invalid_type_error: 'Estoque mínimo deve ser um número' })
    .int('Estoque mínimo deve ser inteiro')
    .min(0, 'Estoque mínimo não pode ser negativo')
    .max(1_000_000)
    .default(0),
  location: z.string().trim().max(60).optional().or(z.literal('')),
  supplierId: idSchema.optional().or(z.literal('')),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema
  .partial()
  .extend({
    /** Logical (de)activation — soft-delete convention (spec §34). */
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'pelo menos um campo deve ser enviado',
  });

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/**
 * Stock movement input (spec §36). Every stock change is registered via the
 * API inside a transaction — direct `stockQuantity` editing is NOT allowed
 * on the product update endpoint (auditable trail is mandatory).
 */
export const stockMovementTypeSchema = z.enum(['IN', 'OUT', 'ADJUSTMENT']);
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;

export const createStockMovementSchema = z
  .object({
    productId: idSchema,
    type: stockMovementTypeSchema,
    quantity: z
      .number({ invalid_type_error: 'Quantidade deve ser um número' })
      .int('Quantidade deve ser inteira')
      .min(1, 'Quantidade deve ser ao menos 1')
      .max(1_000_000),
    reason: z.string().trim().min(3, 'Motivo muito curto').max(255),
  })
  .strict();

export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;

export const productQuerySchema = paginationQuerySchema.extend({
  supplierId: idSchema.optional(),
  lowStock: z.coerce.boolean().optional(),
  includeInactive: z.coerce.boolean().optional(),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;

export const stockMovementQuerySchema = paginationQuerySchema.extend({
  productId: idSchema.optional(),
});

export type StockMovementQuery = z.infer<typeof stockMovementQuerySchema>;

export const productIdSchema = idSchema;
