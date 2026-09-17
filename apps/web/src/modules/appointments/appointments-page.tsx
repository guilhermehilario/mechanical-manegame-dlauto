import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppointmentDto } from '@mechanic-system/types';
import {
  APPOINTMENT_TRANSITIONS,
  type AppointmentStatus,
} from '@mechanic-system/shared';
import { ApiClientError } from '../../services/api-client';
import {
  deleteAppointment,
  listAppointments,
  transitionAppointment,
} from '../../services/appointments.service';
import { AppointmentForm } from './appointment-form';
import { AppointmentsAgenda, type AgendaMode } from './appointments-agenda';
import {
  APPOINTMENT_STATUS_BADGES,
  APPOINTMENT_STATUS_LABELS,
  formatAppointmentDateTime,
} from './appointment-status';
import {
  addDays,
  formatDayLabel,
  startOfDay,
  startOfWeek,
} from '../../utils/dates';

export function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list' | AgendaMode>('list');
  const [cursor, setCursor] = useState<Date>(startOfDay(new Date()));
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'' | AppointmentStatus>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function openForm(appointment: AppointmentDto | null): void {
    setEditingAppointment(appointment);
    setFormOpen(true);
  }

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['appointments'] });
  };

  const appointmentsQuery = useQuery({
    queryKey: ['appointments', 'list', page, statusFilter],
    queryFn: () =>
      listAppointments({ page, status: statusFilter || undefined }),
    enabled: view === 'list',
  });

  // Agenda range: single day or the Monday→Sunday week containing the cursor.
  const agendaRange = (() => {
    if (view === 'day') return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 1) };
    if (view === 'week') {
      const monday = startOfWeek(cursor);
      return { from: monday, to: addDays(monday, 7) };
    }
    return null;
  })();

  const agendaQuery = useQuery({
    queryKey: ['appointments', 'agenda', view, agendaRange?.from.toISOString()],
    queryFn: () => {
      const range = agendaRange;
      if (!range) {
        throw new Error('agenda range unavailable');
      }
      return listAppointments({
        limit: 100,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      });
    },
    enabled: view !== 'list' && agendaRange !== null,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      transitionAppointment(id, status),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiClientError ? error.message : 'Erro ao atualizar agendamento.',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiClientError ? `Erro ao excluir: ${error.message}` : 'Erro ao excluir.',
      );
    },
  });

  const items = appointmentsQuery.data?.items ?? [];
  const totalPages = appointmentsQuery.data?.totalPages ?? 1;

  function handleDelete(appointment: AppointmentDto): void {
    if (
      window.confirm(
        `Excluir definitivamente o agendamento de ${appointment.customerName} (${appointment.vehiclePlate})?`,
      )
    ) {
      deleteMutation.mutate(appointment.id);
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Agendamentos</h1>
        <button
          type="button"
          onClick={() => {
            openForm(null);
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Novo agendamento
        </button>
      </div>

      {/* View toggle */}
      <div className="mb-4 flex gap-2">
        {(['list', 'day', 'week'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setView(option);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              view === option
                ? 'bg-blue-600 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {option === 'list' ? 'Lista' : option === 'day' ? 'Dia' : 'Semana'}
          </button>
        ))}
      </div>

      {actionError ? (
        <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      {view === 'list' ? (
        <>
          <div className="mb-4 flex gap-2">
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value as '' | AppointmentStatus);
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Todos os status</option>
              {(Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatus[]).map((status) => (
                <option key={status} value={status}>
                  {APPOINTMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Data/hora</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Veículo</th>
                  <th className="px-4 py-3">Serviço</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {appointmentsQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Carregando…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Nenhum agendamento encontrado.
                    </td>
                  </tr>
                ) : (
                  items.map((appointment) => {
                    const nextStatuses = APPOINTMENT_TRANSITIONS[appointment.status];
                    const canReschedule =
                      appointment.status !== 'COMPLETED' && appointment.status !== 'CANCELLED';
                    return (
                      <tr key={appointment.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {formatAppointmentDateTime(appointment.scheduledAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{appointment.customerName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {appointment.vehiclePlate}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{appointment.serviceName}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              APPOINTMENT_STATUS_BADGES[appointment.status]
                            }`}
                          >
                            {APPOINTMENT_STATUS_LABELS[appointment.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {nextStatuses.map((next) => (
                            <button
                              key={next}
                              type="button"
                              onClick={() => {
                                transitionMutation.mutate({ id: appointment.id, status: next });
                              }}
                              className="mr-3 text-xs font-medium text-blue-600 hover:underline"
                            >
                              {next === 'CANCELLED' ? 'Cancelar' : APPOINTMENT_STATUS_LABELS[next]}
                            </button>
                          ))}
                          {canReschedule ? (
                            <button
                              type="button"
                              onClick={() => {
                                openForm(appointment);
                              }}
                              className="mr-3 text-xs font-medium text-slate-600 hover:underline"
                            >
                              Editar
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              handleDelete(appointment);
                            }}
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setPage((current) => current - 1);
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      ) : (
        <div>
          {/* Agenda navigation */}
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCursor((current) =>
                  addDays(current, view === 'day' ? -1 : -7),
                );
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              ← Anterior
            </button>
            <button
              type="button"
              onClick={() => {
                setCursor(startOfDay(new Date()));
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => {
                setCursor((current) => addDays(current, view === 'day' ? 1 : 7));
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Próximo →
            </button>
            <span className="ml-2 text-sm font-medium text-slate-700">
              {view === 'day'
                ? formatDayLabel(cursor)
                : `${formatDayLabel(startOfWeek(cursor))} – ${formatDayLabel(
                    addDays(startOfWeek(cursor), 6),
                  )}`}
            </span>
          </div>

          {agendaQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Carregando…</p>
          ) : (
            <AppointmentsAgenda
              appointments={agendaQuery.data?.items ?? []}
              cursor={cursor}
              mode={view}
              onTransition={(id, status) => {
                transitionMutation.mutate({ id, status });
              }}
              onDelete={handleDelete}
            />
          )}
        </div>
      )}

      {formOpen ? (
        <AppointmentForm
          appointment={editingAppointment}
          onClose={() => {
            setFormOpen(false);
          }}
          onSaved={invalidate}
        />
      ) : null}
    </section>
  );
}
