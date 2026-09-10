import type { AppointmentStatus } from '@mechanic-system/shared';

/** Shared presentation maps for appointment statuses (list + agenda). */

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

export const APPOINTMENT_STATUS_BADGES: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-blue-50 text-blue-700',
  CONFIRMED: 'bg-indigo-50 text-indigo-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

/** `dd/mm/aaaa hh:mm` in the local timezone (matching how the slot was picked). */
export function formatAppointmentDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}
