import { z } from 'zod';
import { createSortQuerySchema, idSchema, type SortField } from './common';

/**
 * Vehicle pickup schemas (Fase 7). A pickup is the handover receipt: it is
 * created once per work order (1─1), only while the OS is AWAITING_PICKUP,
 * and the OS moves to DELIVERED in the same transaction.
 */

/** CPF (11 digits) or CNH (11 digits, different check algorithm) — bare digits. */
export const receiverDocSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((value) => value.length === 11, {
    message: 'Documento deve ter 11 dígitos (CPF ou CNH)',
  });

/** Length/shape only — CNH check digits vary; CPF is not required here. */
export const createVehiclePickupSchema = z
  .object({
    receiverName: z
      .string()
      .trim()
      .min(3, 'Nome de quem retira é obrigatório')
      .max(120, 'Nome deve ter no máximo 120 caracteres'),
    receiverDoc: receiverDocSchema,
    receiverPhone: z
      .string()
      .trim()
      .transform((value) => value.replace(/\D/g, ''))
      .refine((value) => value.length === 0 || (value.length >= 10 && value.length <= 11), {
        message: 'Telefone deve ter 10 ou 11 dígitos',
      })
      .optional()
      .or(z.literal('')),
    mileageKm: z
      .number({ invalid_type_error: 'KM deve ser um número' })
      .int('KM deve ser inteiro')
      .min(0, 'KM não pode ser negativo')
      .max(3_000_000)
      .optional(),
    /** base64 PNG from the signature pad (client-side capture, optional). */
    signatureData: z
      .string()
      .max(500_000, 'Assinatura muito grande')
      .optional()
      .or(z.literal('')),
    notes: z.string().trim().max(2000).optional().or(z.literal('')),
  })
  .strict();

export type CreateVehiclePickupInput = z.infer<typeof createVehiclePickupSchema>;

/** Sortable columns for the pickups listing (whitelist). */
export const VEHICLE_PICKUP_SORT_FIELDS = ['receiverName', 'createdAt'] as const;

export const vehiclePickupQuerySchema = createSortQuerySchema(VEHICLE_PICKUP_SORT_FIELDS);

export type VehiclePickupQuery = z.infer<typeof vehiclePickupQuerySchema>;
export type VehiclePickupSortField = SortField<typeof VEHICLE_PICKUP_SORT_FIELDS>;

export const workOrderPickupIdSchema = idSchema;
