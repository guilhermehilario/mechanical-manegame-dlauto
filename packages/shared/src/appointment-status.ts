import { z } from 'zod';

/**
 * Appointment status machine (Fase 4 — agendamentos).
 * Centralized so backend, frontend and tests share one source of truth,
 * mirroring work-order-status.ts (spec §11/§33 — backend enforces).
 */

export const APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;

export const AppointmentStatus = z.enum(APPOINTMENT_STATUSES);
export type AppointmentStatus = z.infer<typeof AppointmentStatus>;

/**
 * Allowed transitions. Anything not listed must be rejected by the backend
 * (409 INVALID_APPOINTMENT_TRANSITION).
 */
export const APPOINTMENT_TRANSITIONS: Readonly<
  Record<AppointmentStatus, readonly AppointmentStatus[]>
> = {
  SCHEDULED: ['CONFIRMED', 'IN_PROGRESS', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

/** Business rule: can an appointment move from `from` to `to`? */
export function canTransitionAppointment(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return APPOINTMENT_TRANSITIONS[from].includes(to);
}

/** Statuses that still occupy a slot in the schedule (conflict checks). */
export const ACTIVE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
];

export function isActiveAppointmentStatus(status: AppointmentStatus): boolean {
  return ACTIVE_APPOINTMENT_STATUSES.includes(status);
}
