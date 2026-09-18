import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VehicleDto } from '@mechanic-system/types';
import { ApiClientError } from '../../services/api-client';
import {
  deleteCustomer,
  getCustomer,
  updateCustomer,
} from '../../services/customers.service';
import {
  deleteVehicle,
  listVehiclesByCustomer,
} from '../../services/vehicles.service';
import { CustomerForm } from './customer-form';
import { VehicleForm } from '../vehicles/vehicle-form';
import { PageHeader } from '../../components/page-header';
import { btnDanger, btnPrimary, btnSecondary } from '../../components/ui';
import { formatCpf, formatDate, formatPhone } from '../../utils/format';

interface HistoryEntry {
  date: string;
  description: string;
  key: string;
}

export function CustomerDetailPage(): React.ReactNode {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isVehicleFormOpen, setIsVehicleFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const customerQuery = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id),
    enabled: id !== '',
  });

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', 'by-customer', id],
    queryFn: () => listVehiclesByCustomer(id),
    enabled: id !== '',
  });

  const updateCustomerMutation = useMutation({
    mutationFn: (input: { id: string; active: boolean }) =>
      updateCustomer(input.id, { active: input.active }),
    onError: () => {
      setActionError('Não foi possível alterar o status do cliente.');
    },
    onSuccess: () => {
      setActionError(null);
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void navigate('/customers');
    },
    onError: () => {
      setActionError('Não foi possível excluir o cliente.');
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: (vehicleId: string) => deleteVehicle(vehicleId),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['vehicles', 'by-customer', id] });
    },
    onError: () => {
      setActionError('Não foi possível excluir o veículo.');
    },
  });

  const customer = customerQuery.data;
  const vehicles: VehicleDto[] = vehiclesQuery.data ?? [];

  // Derived event history (spec §14: maintenance history will come from work
  // orders in Phase 5 — no separate table, derived queries only).
  const history: HistoryEntry[] = vehicles
    .map((vehicle) => ({
      date: vehicle.createdAt,
      description: `Veículo cadastrado: ${vehicle.brand} ${vehicle.model} (${vehicle.plate})`,
      key: `vehicle-${vehicle.id}`,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  function handleToggleActive(): void {
    if (!customer) return;
    updateCustomerMutation.mutate({ id: customer.id, active: !customer.active });
  }

  function handleDeleteCustomer(): void {
    if (!customer) return;
    if (window.confirm(`Excluir o cliente "${customer.name}"? Ele desaparecerá das listagens.`)) {
      deleteCustomerMutation.mutate(customer.id);
    }
  }

  function handleDeleteVehicle(vehicle: VehicleDto): void {
    if (window.confirm(`Excluir o veículo "${vehicle.plate}"?`)) {
      deleteVehicleMutation.mutate(vehicle.id);
    }
  }

  if (customerQuery.isError) {
    const error = customerQuery.error;
    return (
      <section>
        <Link to="/customers" className="text-sm text-blue-600 hover:underline">
          ← Voltar para clientes
        </Link>
        <div role="alert" className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof ApiClientError && error.code === 'CUSTOMER_NOT_FOUND'
            ? 'Cliente não encontrado.'
            : 'Não foi possível carregar o cliente.'}
        </div>
      </section>
    );
  }

  if (!customer) {
    return (
      <section>
        <p className="text-sm text-slate-500">Carregando…</p>
      </section>
    );
  }

  return (
    <section>
      <Link to="/customers" className="text-sm font-medium text-blue-600 hover:underline">
        ← Voltar para clientes
      </Link>

      <div className="mt-3">
        <PageHeader
          title={customer.name}
          description={`Cliente desde ${formatDate(customer.createdAt)}`}
          actions={
            <>
              <button type="button" onClick={handleToggleActive} className={btnSecondary}>
                {customer.active ? 'Desativar' : 'Reativar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditOpen(true);
                }}
                className={btnPrimary}
              >
                Editar
              </button>
              <button type="button" onClick={handleDeleteCustomer} className={btnDanger}>
                Excluir
              </button>
            </>
          }
        />
      </div>

      {actionError ? (
        <div role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Dados cadastrais</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">CPF</dt>
              <dd className="font-medium text-slate-800">{formatCpf(customer.cpf)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Telefone</dt>
              <dd className="font-medium text-slate-800">{formatPhone(customer.phone)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">E-mail</dt>
              <dd className="font-medium text-slate-800">{customer.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Endereço</dt>
              <dd className="font-medium text-slate-800">{customer.address ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    customer.active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {customer.active ? 'Ativo' : 'Inativo'}
                </span>
              </dd>
            </div>
          </dl>
          {customer.notes ? (
            <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
              {customer.notes}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Histórico</h2>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nenhum evento ainda.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {history.map((entry) => (
                <li key={entry.key} className="flex justify-between gap-4">
                  <span className="text-slate-600">{entry.description}</span>
                  <span className="shrink-0 text-slate-500">{formatDate(entry.date)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
            O histórico de manutenções aparecerá aqui a partir da Fase 5 (ordens de serviço).
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Veículos ({vehicles.length})</h2>
        <button
          type="button"
          onClick={() => {
            setIsVehicleFormOpen(true);
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Novo veículo
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Veículo</th>
              <th className="px-4 py-3">Ano</th>
              <th className="px-4 py-3">KM</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {vehiclesQuery.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : vehicles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Nenhum veículo cadastrado para este cliente.
                </td>
              </tr>
            ) : (
              vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-mono font-medium text-slate-800">{vehicle.plate}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {vehicle.brand} {vehicle.model}
                    {vehicle.color ? ` · ${vehicle.color}` : ''}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{vehicle.year ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {vehicle.mileage === null
                      ? '—'
                      : `${vehicle.mileage.toLocaleString('pt-BR')} km`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteVehicle(vehicle);
                      }}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isEditOpen ? (
        <CustomerForm
          customer={customer}
          onClose={() => {
            setIsEditOpen(false);
          }}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['customer', id] });
            void queryClient.invalidateQueries({ queryKey: ['customers'] });
          }}
        />
      ) : null}

      {isVehicleFormOpen ? (
        <VehicleForm
          vehicle={null}
          fixedCustomerId={customer.id}
          onClose={() => {
            setIsVehicleFormOpen(false);
          }}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['vehicles', 'by-customer', id] });
          }}
        />
      ) : null}
    </section>
  );
}
