import { z } from 'zod';
import { idSchema, paginationQuerySchema } from './common';

/**
 * Supplier schemas (Fase 3).
 * CNPJ validation with check digits; only the 14 bare digits are stored.
 */
export function isValidCnpj(rawCnpj: string): boolean {
  const cnpj = rawCnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // all same digit

  const calcDigit = (base: string): number => {
    let weight = base.length - 7; // 12 → 5..2 / 13 → 6..2
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += Number(base[i]) * weight;
      weight -= 1;
      if (weight < 2) weight = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const base = cnpj.slice(0, 12);
  const dv1 = calcDigit(base);
  const dv2 = calcDigit(`${base}${dv1}`);
  return dv1 === Number(cnpj[12]) && dv2 === Number(cnpj[13]);
}

/** Normalizes any masked/unmasked CNPJ to bare 14 digits (canonical form). */
export function normalizeCnpj(rawCnpj: string): string {
  return rawCnpj.replace(/\D/g, '');
}

export const cnpjSchema = z
  .string()
  .trim()
  .transform(normalizeCnpj)
  .refine(isValidCnpj, { message: 'CNPJ inválido' });

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(120),
  cnpj: cnpjSchema,
  phone: z
    .string()
    .trim()
    .min(10, 'Telefone deve ter DDD + número')
    .max(20)
    .regex(/^[\d\s()+-]+$/, 'Telefone contém caracteres inválidos'),
  email: z.string().email('E-mail inválido').max(255).toLowerCase().optional().or(z.literal('')),
  address: z.string().trim().max(255).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema
  .partial()
  .extend({
    /** Logical (de)activation — soft-delete convention (spec §34). */
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'pelo menos um campo deve ser enviado',
  });

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const supplierQuerySchema = paginationQuerySchema.extend({
  includeInactive: z.coerce.boolean().optional(),
});

export type SupplierQuery = z.infer<typeof supplierQuerySchema>;

export const supplierIdSchema = idSchema;
