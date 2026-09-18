import { z } from 'zod';
import { AppointmentStatus } from '@mechanic-system/shared';
import { createSortQuerySchema, idSchema, type SortField } from './common';

/**
 * Appointment schemas (Fase 4).
 * Dates travel as ISO strings; the API stores UTC. The service duration is
 * resolved from the catalog (estimatedMinutes) when checking conflicts.
 */

/** ISO datetime string parseable as a valid date. */
export const scheduledAtSchema = z
  .string({ required_error: 'Data/hora é obrigatória' })
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Data/hora inválida',
  });

export const createAppointmentSchema = z
  .object({
    customerId: idSchema,
    vehicleId: idSchema,
    serviceId: idSchema,
    scheduledAt: scheduledAtSchema,
    notes: z.string().trim().max(2000).optional().or(z.literal('')),
  })
  .strict();

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = z
  .object({
    scheduledAt: scheduledAtSchema.optional(),
    serviceId: idSchema.optional(),
    notes: z.string().trim().max(2000).optional().or(z.literal('')),
    status: AppointmentStatus.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'pelo menos um campo deve ser enviado',
  });

export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

/** Sortable columns for the appointments listing (whitelist). */
export const APPOINTMENT_SORT_FIELDS = ['scheduledAt', 'status', 'createdAt'] as const;

export const appointmentQuerySchema = createSortQuerySchema(APPOINTMENT_SORT_FIELDS).extend({
  customerId: idSchema.optional(),
  vehicleId: idSchema.optional(),
  status: AppointmentStatus.optional(),
  /** `from`/`to` — ISO date range filter for calendar views. */
  from: scheduledAtSchema.optional(),
  to: scheduledAtSchema.optional(),
});

export type AppointmentQuery = z.infer<typeof appointmentQuerySchema>;
export type AppointmentSortField = SortField<typeof APPOINTMENT_SORT_FIELDS>;

export const appointmentIdSchema = idSchema;

/** Status-only transition endpoint body. */
export const transitionAppointmentSchema = z.object({
  status: AppointmentStatus,
});
export type TransitionAppointmentInput = z.infer<typeof transitionAppointmentSchema>;
