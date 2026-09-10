import { z } from 'zod';
import { idSchema, paginationQuerySchema } from './common';

/**
 * Service catalog schemas (Fase 3).
 * Price is an integer amount in cents (spec §18) — the UI converts to BRL
 * presentation; the API only ever sees `priceCents`.
 */

export const servicePriceSchema = z
  .number({ invalid_type_error: 'Preço deve ser um número' })
  .int('Preço deve ser informado em centavos (inteiro)')
  .min(0, 'Preço não pode ser negativo')
  .max(900_000_000_00, 'Preço acima do limite seguro');

export const createServiceSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(120),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  priceCents: servicePriceSchema,
  estimatedMinutes: z
    .number({ invalid_type_error: 'Tempo estimado deve ser um número' })
    .int('Tempo estimado deve ser inteiro')
    .min(1, 'Tempo estimado deve ser ao menos 1 minuto')
    .max(60 * 24 * 30, 'Tempo estimado muito longo')
    .optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema
  .partial()
  .extend({
    /** Logical (de)activation — soft-delete convention (spec §34). */
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'pelo menos um campo deve ser enviado',
  });

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const serviceQuerySchema = paginationQuerySchema.extend({
  includeInactive: z.coerce.boolean().optional(),
});

export type ServiceQuery = z.infer<typeof serviceQuerySchema>;

export const serviceIdSchema = idSchema;
