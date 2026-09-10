import { type FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createWorkOrderSchema } from '@mechanic-system/validation';
import { ApiClientError } from '../../services/api-client';
import { createWorkOrder } from '../../services/work-orders.service';
import { listCustomers } from '../../services/customers.service';
import { listVehicles } from '../../services/vehicles.service';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

interface FieldErrors {
  [field: string]: string | undefined;
}

interface WorkOrderFormProps {
  onClose: () => void;
  onSaved: () => void;
}

/** Creation form (Fase 5): items are added on the detail page afterwards. */
export function WorkOrderForm({ onClose, onSaved }: WorkOrderFormProps) {
  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const customersQuery = useQuery({
    queryKey: ['customers', 'for-wo-select'],
    queryFn: () => listCustomers({ limit: 100 }),
  });

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', 'for-wo-select', customerId],
    queryFn: () => listVehicles({ limit: 100, customerId: customerId || undefined }),
    enabled: customerId !== '',
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const raw = { customerId, vehicleId, notes };
    const parsed = createWorkOrderSchema.safeParse(raw);
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
      await createWorkOrder(parsed.data);
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'VEHICLE_NOT_OWNED_BY_CUSTOMER') {
        setFormError('O veículo selecionado não pertence ao cliente informado.');
      } else {
        setFormError('Não foi possível abrir a Ordem de Serviço. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-bold text-slate-900">Nova Ordem de Serviço</h2>
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="space-y-4"
          noValidate
        >
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
              disabled={isSubmitting || customerId === ''}
            >
              <option value="">
                {customerId ? 'Selecione o veículo…' : 'Escolha um cliente primeiro'}
              </option>
              {(vehiclesQuery.data?.items ?? []).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate} — {vehicle.brand} {vehicle.model}
                </option>
              ))}
            </select>
          ), fieldErrors.vehicleId)}

          {field('Observações', 'notes', (
            <textarea
              id="notes"
              rows={3}
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
              {isSubmitting ? 'Abrindo…' : 'Abrir OS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
