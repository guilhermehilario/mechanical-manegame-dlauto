import { type FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createAppointmentSchema, updateAppointmentSchema } from '@mechanic-system/validation';
import type { AppointmentDto } from '@mechanic-system/types';
import { ApiClientError } from '../../services/api-client';
import { createAppointment, updateAppointment } from '../../services/appointments.service';
import { listCustomers } from '../../services/customers.service';
import { listVehicles } from '../../services/vehicles.service';
import { listServices } from '../../services/catalog.service';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

interface FieldErrors {
  [field: string]: string | undefined;
}

/** Converts a Date to the `datetime-local` input format (local time). */
function toLocalInputValue(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

interface AppointmentFormProps {
  appointment: AppointmentDto | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Presentation only (spec §23). Conflicts are detected by the backend
 * (APPOINTMENT_CONFLICT) and surfaced here as a friendly message.
 */
export function AppointmentForm({ appointment, onClose, onSaved }: AppointmentFormProps) {
  const isEdit = appointment !== null;
  const [customerId, setCustomerId] = useState(appointment?.customerId ?? '');
  const [vehicleId, setVehicleId] = useState(appointment?.vehicleId ?? '');
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? '');
  const [scheduledAt, setScheduledAt] = useState(
    appointment ? toLocalInputValue(new Date(appointment.scheduledAt)) : '',
  );
  const [notes, setNotes] = useState(appointment?.notes ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const customersQuery = useQuery({
    queryKey: ['customers', 'for-appointment-select'],
    queryFn: () => listCustomers({ limit: 100 }),
    enabled: !isEdit || !appointment?.customerId,
  });

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', 'for-appointment-select', customerId],
    queryFn: () => listVehicles({ limit: 100, customerId: customerId || undefined }),
    enabled: !isEdit,
  });

  const servicesQuery = useQuery({
    queryKey: ['services', 'for-appointment-select'],
    queryFn: () => listServices({ limit: 100 }),
    enabled: !isEdit || !appointment?.serviceId,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (isEdit) {
      const raw: Record<string, unknown> = {};
      if (scheduledAt) raw.scheduledAt = new Date(scheduledAt).toISOString();
      if (serviceId && serviceId !== appointment.serviceId) raw.serviceId = serviceId;
      if (notes !== (appointment.notes ?? '')) raw.notes = notes;
      const parsed = updateAppointmentSchema.safeParse(raw);
      if (!parsed.success) {
        const errors: FieldErrors = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path[0];
          if (typeof field === 'string' && !errors[field]) errors[field] = issue.message;
        }
        setFieldErrors(errors);
        return;
      }
      setIsSubmitting(true);
      try {
        await updateAppointment(appointment.id, parsed.data);
        onSaved();
        onClose();
      } catch (error) {
        handleSaveError(error);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const raw = {
      customerId,
      vehicleId,
      serviceId,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : scheduledAt,
      notes,
    };
    const parsed = createAppointmentSchema.safeParse(raw);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && !errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setIsSubmitting(true);
    try {
      await createAppointment(parsed.data);
      onSaved();
      onClose();
    } catch (error) {
      handleSaveError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSaveError(error: unknown): void {
    if (error instanceof ApiClientError && error.code === 'APPOINTMENT_CONFLICT') {
      setFormError(
        'Este veículo já possui um agendamento ativo nesse horário. Escolha outro horário.',
      );
    } else if (error instanceof ApiClientError && error.code === 'VEHICLE_NOT_OWNED_BY_CUSTOMER') {
      setFormError('O veículo selecionado não pertence ao cliente informado.');
    } else {
      setFormError('Não foi possível salvar o agendamento. Tente novamente.');
    }
  }

  function field(label: string, id: string, node: React.ReactNode, error?: string): React.ReactNode {
    return (
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </label>
        {node}
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  const selectedCustomerVehicles = isEdit ? [] : (vehiclesQuery.data?.items ?? []);

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-bold text-slate-900">
          {isEdit ? 'Editar agendamento' : 'Novo agendamento'}
        </h2>
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="space-y-4"
          noValidate
        >
          {isEdit ? (
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {appointment.customerName} — {appointment.vehiclePlate}
            </div>
          ) : (
            <>
              {field('Cliente *', 'customerId', (
                <select
                  id="customerId"
                  className={inputClass}
                  value={customerId}
                  onChange={(event) => {
                    setCustomerId(event.target.value);
                    setVehicleId('');
                  }}
                  disabled={isSubmitting}
                >
                  <option value="">Selecione o cliente…</option>
                  {(customersQuery.data?.items ?? []).map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              ), fieldErrors.customerId)}

              {field('Veículo *', 'vehicleId', (
                <select
                  id="vehicleId"
                  className={inputClass}
                  value={vehicleId}
                  onChange={(event) => {
                    setVehicleId(event.target.value);
                  }}
                  disabled={isSubmitting || !customerId}
                >
                  <option value="">
                    {customerId ? 'Selecione o veículo…' : 'Escolha um cliente primeiro'}
                  </option>
                  {selectedCustomerVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate} — {vehicle.brand} {vehicle.model}
                    </option>
                  ))}
                </select>
              ), fieldErrors.vehicleId)}
            </>
          )}

          {field('Serviço *', 'serviceId', (
            <select
              id="serviceId"
              className={inputClass}
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value);
              }}
              disabled={isSubmitting}
            >
              <option value="">Selecione o serviço…</option>
              {(isEdit
                ? [{ id: appointment.serviceId, name: appointment.serviceName }]
                : (servicesQuery.data?.items ?? [])
              ).map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          ), fieldErrors.serviceId)}

          {field('Data e hora *', 'scheduledAt', (
            <input
              id="scheduledAt"
              type="datetime-local"
              className={inputClass}
              value={scheduledAt}
              onChange={(event) => {
                setScheduledAt(event.target.value);
              }}
              disabled={isSubmitting}
            />
          ), fieldErrors.scheduledAt)}

          {field('Observações', 'notes', (
            <textarea
              id="notes"
              rows={2}
              className={inputClass}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
              disabled={isSubmitting}
            />
          ), fieldErrors.notes)}

          {formError ? (
            <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
