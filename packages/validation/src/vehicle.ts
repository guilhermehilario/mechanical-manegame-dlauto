import { z } from 'zod';
import { createSortQuerySchema, idSchema, type SortField } from './common';

/** Brazilian plates: old format (AAA9999) and Mercosul (AAA9A99). */
const PLATE_REGEX = /^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/;

export const plateSchema = z
  .string()
  .trim()
  .transform((plate) => plate.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .refine((plate) => PLATE_REGEX.test(plate), {
    message: 'Placa inválida (use AAA9999 ou AAA9A99)',
  });

const currentYear = new Date().getFullYear();

export const vehicleYearSchema = z.coerce
  .number()
  .int()
  .min(1950, 'Ano muito antigo')
  .max(currentYear + 1, `Ano não pode ser maior que ${currentYear + 1}`);

export const mileageSchema = z.coerce.number().int().min(0).max(2_000_000);

export const createVehicleSchema = z.object({
  customerId: idSchema,
  plate: plateSchema,
  brand: z.string().trim().min(2, 'Marca muito curta').max(60),
  model: z.string().trim().min(1, 'Modelo obrigatório').max(80),
  year: vehicleYearSchema.optional(),
  color: z.string().trim().max(40).optional().or(z.literal('')),
  mileage: mileageSchema.optional(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = createVehicleSchema
  .omit({ customerId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'pelo menos um campo deve ser enviado',
  });

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

/** Sortable columns for the vehicles listing (whitelist). */
export const VEHICLE_SORT_FIELDS = ['plate', 'brand', 'model', 'year', 'createdAt', 'updatedAt'] as const;

export const vehicleQuerySchema = createSortQuerySchema(VEHICLE_SORT_FIELDS).extend({
  /** Filter by owner. */
  customerId: idSchema.optional(),
  includeInactive: z.coerce.boolean().optional(),
});

export type VehicleQuery = z.infer<typeof vehicleQuerySchema>;
export type VehicleSortField = SortField<typeof VEHICLE_SORT_FIELDS>;

export const vehicleIdSchema = idSchema;
