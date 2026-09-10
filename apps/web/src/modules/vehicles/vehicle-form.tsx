import { type FormEvent, useState } from 'react';
import { createVehicleSchema, updateVehicleSchema } from '@mechanic-system/validation';
import type { VehicleDto } from '@mechanic-system/types';
import type { CreateVehicleInput, UpdateVehicleInput } from '@mechanic-system/validation';
import { ApiClientError } from '../../services/api-client';
import {
  createVehicle,
  updateVehicle,
} from '../../services/vehicles.service';
import { listCustomers } from '../../services/customers.service';
import { useQuery } from '@tanstack/react-query';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

interface FieldErrors {
  [field: string]: string | undefined;
}

interface VehicleFormProps {
  vehicle: VehicleDto | null;
  /** Pre-selected owner (e.g. when creating from the customer detail view). */
  fixedCustomerId?: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Presentation only (spec §23): validation via shared Zod schemas; HTTP via
 * the service layer. The customer select loads options from the API.
 */
export function VehicleForm({ vehicle, fixedCustomerId, onClose, onSaved }: VehicleFormProps) {
  const isEdit = vehicle !== null;
  const [customerId, setCustomerId] = useState(vehicle?.customerId ?? fixedCustomerId ?? '');
  const [plate, setPlate] = useState(vehicle?.plate ?? '');
  const [brand, setBrand] = useState(vehicle?.brand ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [year, setYear] = useState(vehicle?.year ? String(vehicle.year) : '');
  const [color, setColor] = useState(vehicle?.color ?? '');
  const [mileage, setMileage] = useState(vehicle?.mileage ? String(vehicle.mileage) : '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const customersQuery = useQuery({
    queryKey: ['customers', 'for-vehicle-select'],
    queryFn: () => listCustomers({ limit: 100 }),
    enabled: !isEdit,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const raw = {
      customerId,
      plate,
      brand,
      model,
      ...(year ? { year: Number(year) } : {}),
      ...(color ? { color } : {}),
      ...(mileage ? { mileage: Number(mileage) } : {}),
    };
    const parsed = isEdit ? updateVehicleSchema.safeParse(raw) : createVehicleSchema.safeParse(raw);
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
      if (isEdit) {
        const data: UpdateVehicleInput = parsed.data;
        await updateVehicle(vehicle.id, {
          ...(data.plate !== undefined ? { plate: data.plate } : {}),
          ...(data.brand !== undefined ? { brand: data.brand } : {}),
          ...(data.model !== undefined ? { model: data.model } : {}),
          ...(data.year !== undefined ? { year: data.year } : {}),
          ...(data.color !== undefined ? { color: data.color } : {}),
          ...(data.mileage !== undefined ? { mileage: data.mileage } : {}),
        });
      } else {
        await createVehicle(parsed.data as CreateVehicleInput);
      }
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'VEHICLE_PLATE_ALREADY_EXISTS') {
        setFieldErrors({ plate: 'Esta placa já está cadastrada.' });
      } else if (error instanceof ApiClientError && error.code === 'CUSTOMER_NOT_FOUND') {
        setFormError('Cliente não encontrado. Atualize a página e tente novamente.');
      } else {
        setFormError('Não foi possível salvar o veículo. Tente novamente.');
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
        <h2 className="mb-4 text-base font-bold text-slate-900">
          {isEdit ? 'Editar veículo' : 'Novo veículo'}
        </h2>
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
              }}
              disabled={isSubmitting || isEdit}
            >
              <option value="">Selecione o cliente…</option>
              {(customersQuery.data?.items ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.cpf})
                </option>
              ))}
            </select>
          ), fieldErrors.customerId)}

          <div className="grid grid-cols-2 gap-4">
            {field('Placa *', 'plate', (
              <input
                id="plate"
                className={`${inputClass} uppercase`}
                placeholder="ABC1D23"
                maxLength={8}
                value={plate}
                onChange={(event) => {
                  setPlate(event.target.value.toUpperCase());
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.plate)}

            {field('Ano', 'year', (
              <input
                id="year"
                type="number"
                className={inputClass}
                placeholder="2020"
                value={year}
                onChange={(event) => {
                  setYear(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.year)}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field('Marca *', 'brand', (
              <input
                id="brand"
                className={inputClass}
                placeholder="Volkswagen"
                value={brand}
                onChange={(event) => {
                  setBrand(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.brand)}

            {field('Modelo *', 'model', (
              <input
                id="model"
                className={inputClass}
                placeholder="Gol"
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.model)}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field('Cor', 'color', (
              <input
                id="color"
                className={inputClass}
                value={color}
                onChange={(event) => {
                  setColor(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.color)}

            {field('Quilometragem', 'mileage', (
              <input
                id="mileage"
                type="number"
                min={0}
                className={inputClass}
                placeholder="45000"
                value={mileage}
                onChange={(event) => {
                  setMileage(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.mileage)}
          </div>

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
