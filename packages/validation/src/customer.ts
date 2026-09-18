import { z } from 'zod';
import { createSortQuerySchema, idSchema, type SortField } from './common';

/**
 * CPF validation (spec: customers — unique CPF).
 * Accepts only the 11 digits; formatting is a presentation concern.
 * Rejects known-invalid sequences (all same digit, wrong check digits).
 */
export function isValidCpf(rawCpf: string): boolean {
  const cpf = rawCpf.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // 000.000.000-00 etc.

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(cpf[i]) * (10 - i);
  }
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(cpf[i]) * (11 - i);
  }
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
}

/** Normalizes any masked/unmasked CPF to bare 11 digits (stored canonical form). */
export function normalizeCpf(rawCpf: string): string {
  return rawCpf.replace(/\D/g, '');
}

export const cpfSchema = z
  .string()
  .trim()
  .transform(normalizeCpf)
  .refine(isValidCpf, { message: 'CPF inválido' });

export const phoneSchema = z
  .string()
  .trim()
  .min(10, 'Telefone deve ter DDD + número')
  .max(20)
  .regex(/^[\d\s()+-]+$/, 'Telefone contém caracteres inválidos');

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(120),
  cpf: cpfSchema,
  phone: phoneSchema,
  email: z.string().email('E-mail inválido').max(255).toLowerCase().optional().or(z.literal('')),
  address: z.string().trim().max(255).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema
  .partial()
  .extend({
    /** Logical (de)activation — soft-delete convention (spec §34). */
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'pelo menos um campo deve ser enviado',
  });

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

/** Sortable columns for the customers listing (whitelist). */
export const CUSTOMER_SORT_FIELDS = ['name', 'cpf', 'phone', 'email', 'createdAt', 'updatedAt'] as const;

export const customerQuerySchema = createSortQuerySchema(CUSTOMER_SORT_FIELDS).extend({
  /** `all` includes inactive/deleted records (e.g. to preserve history views). */
  includeInactive: z.coerce.boolean().optional(),
});

export type CustomerQuery = z.infer<typeof customerQuerySchema>;
export type CustomerSortField = SortField<typeof CUSTOMER_SORT_FIELDS>;

export const customerIdSchema = idSchema;
