import { useMemo } from 'react';
import type { AppointmentDto } from '@mechanic-system/types';
import {
  APPOINTMENT_TRANSITIONS,
  type AppointmentStatus,
} from '@mechanic-system/shared';
import {
  formatDayLabel,
  formatDayLong,
  isToday,
  startOfDay,
  weekDays,
} from '../../utils/dates';
import { formatTime } from '../../utils/datetime';
import {
  APPOINTMENT_STATUS_BADGES,
  APPOINTMENT_STATUS_LABELS,
} from './appointment-status';
import type { TimeFormat } from '@mechanic-system/types';
import { useTimeFormat } from '../../hooks/use-time-format';

type AgendaMode = 'day' | 'week';

interface AppointmentsAgendaProps {
  /** Appointments within the visible range (fetched by the host page). */
  appointments: AppointmentDto[];
  cursor: Date;
  mode: AgendaMode;
  /** Callbacks delegated up — the page owns mutations and error handling. */
  onTransition: (id: string, status: AppointmentStatus) => void;
  onDelete: (appointment: AppointmentDto) => void;
}

const dayKey = (date: Date): string => startOfDay(date).toISOString();

/**
 * Agenda views (day/week) over the same API as the list, using the
 * `from`/`to` range filters (Fase 4). Pure presentation: data fetching and
 * mutations live in the page that hosts this component.
 */
export function AppointmentsAgenda({
  appointments,
  cursor,
  mode,
  onTransition,
  onDelete,
}: AppointmentsAgendaProps) {
  const timeFormat = useTimeFormat();
  const days: Date[] =
    mode === 'day' ? [startOfDay(cursor)] : weekDays(cursor).map(startOfDay);

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentDto[]>();
    for (const appointment of appointments) {
      const key = startOfDay(new Date(appointment.scheduledAt)).toISOString();
      const bucket = map.get(key) ?? [];
      bucket.push(appointment);
      map.set(key, bucket);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    }
    return map;
  }, [appointments]);

  return (
    <div>
      {days.length === 1 && days[0] ? (
        <div
          className={`mb-3 rounded-md border px-3 py-2 text-sm font-semibold ${
            isToday(days[0])
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}
        >
          {formatDayLong(days[0])}
        </div>
      ) : null}

      <div className={days.length > 1 ? 'grid grid-cols-7 gap-2' : ''}>
        {days.map((day) => (
          <div key={dayKey(day)} className="min-w-0">
            {days.length > 1 ? (
              <div
                className={`mb-2 rounded-md border px-2 py-1.5 text-center text-xs font-semibold ${
                  isToday(day)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                {formatDayLabel(day)}
              </div>
            ) : null}
            <AppointmentCards
              appointments={byDay.get(dayKey(day)) ?? []}
              timeFormat={timeFormat}
              onTransition={onTransition}
              onDelete={onDelete}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function AppointmentCards({
  appointments,
  timeFormat,
  onTransition,
  onDelete,
}: {
  appointments: AppointmentDto[];
  timeFormat: TimeFormat;
  onTransition: (id: string, status: AppointmentStatus) => void;
  onDelete: (appointment: AppointmentDto) => void;
}) {
  if (appointments.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-200 px-2 py-3 text-center text-xs text-slate-400">
        —
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {appointments.map((appointment) => (
        <div
          key={appointment.id}
          className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-sm"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="font-semibold text-slate-800">
              {formatTime(new Date(appointment.scheduledAt), timeFormat)}
            </span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                APPOINTMENT_STATUS_BADGES[appointment.status]
              }`}
            >
              {APPOINTMENT_STATUS_LABELS[appointment.status]}
            </span>
          </div>
          <p
            className="mt-1 truncate font-medium text-slate-700"
            title={appointment.customerName}
          >
            {appointment.customerName}
          </p>
          <p className="font-mono text-[10px] text-slate-500">{appointment.vehiclePlate}</p>
          <p className="truncate text-slate-500">{appointment.serviceName}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {APPOINTMENT_TRANSITIONS[appointment.status].map((next) => (
              <button
                key={next}
                type="button"
                onClick={() => {
                  onTransition(appointment.id, next);
                }}
                className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100"
              >
                {next === 'CANCELLED' ? 'Cancelar' : APPOINTMENT_STATUS_LABELS[next]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                onDelete(appointment);
              }}
              className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-100"
            >
              Excluir
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export type { AgendaMode };
