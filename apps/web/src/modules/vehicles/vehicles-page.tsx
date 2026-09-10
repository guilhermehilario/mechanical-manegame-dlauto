import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VehicleDto } from '@mechanic-system/types';
import { ApiClientError } from '../../services/api-client';
import { deleteVehicle, listVehicles } from '../../services/vehicles.service';
import { listCustomers } from '../../services/customers.service';
import { VehicleForm } from './vehicle-form';

function formatMileage(mileage: number | null): string {
  if (mileage === null) return '—';
  return `${mileage.toLocaleString('pt-BR')} km`;
}

export function VehiclesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [formVehicle, setFormVehicle] = useState<VehicleDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ['customers', 'for-filter'],
    queryFn: () => listCustomers({ limit: 100 }),
  });

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', page, submittedSearch, customerFilter],
    queryFn: () =>
      listVehicles({
        page,
        search: submittedSearch || undefined,
        customerId: customerFilter || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiClientError
          ? `Erro ao excluir: ${error.message}`
          : 'Erro ao excluir veículo.',
      );
    },
  });

  const items = vehiclesQuery.data?.items ?? [];
  const totalPages = vehiclesQuery.data?.totalPages ?? 1;
  const customerNameById = new Map(
    (customersQuery.data?.items ?? []).map((customer) => [customer.id, customer.name]),
  );

  function handleDelete(vehicle: VehicleDto): void {
    if (window.confirm(`Excluir o veículo "${vehicle.plate}"?`)) {
      deleteMutation.mutate(vehicle.id);
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Veículos</h1>
        <button
          type="button"
          onClick={() => {
            setFormVehicle(null);
            setIsFormOpen(true);
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Novo veículo
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSubmittedSearch(search.trim());
          }}
        >
          <input
            type="search"
            placeholder="Buscar por placa, marca ou modelo…"
            className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
          <button
            type="submit"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Buscar
          </button>
        </form>
        <select
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          value={customerFilter}
          onChange={(event) => {
            setPage(1);
            setCustomerFilter(event.target.value);
          }}
        >
          <option value="">Todos os clientes</option>
          {(customersQuery.data?.items ?? []).map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      {actionError ? (
        <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Veículo</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Ano</th>
              <th className="px-4 py-3">KM</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {vehiclesQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhum veículo encontrado.
                </td>
              </tr>
            ) : (
              items.map((vehicle) => (
                <tr key={vehicle.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-mono font-medium text-slate-800">{vehicle.plate}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {vehicle.brand} {vehicle.model}
                    {vehicle.color ? ` · ${vehicle.color}` : ''}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {customerNameById.get(vehicle.customerId) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{vehicle.year ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatMileage(vehicle.mileage)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setFormVehicle(vehicle);
                        setIsFormOpen(true);
                      }}
                      className="mr-3 text-xs font-medium text-blue-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleDelete(vehicle);
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

      {isFormOpen ? (
        <VehicleForm
          vehicle={formVehicle}
          onClose={() => {
            setIsFormOpen(false);
          }}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
            void queryClient.invalidateQueries({ queryKey: ['customers'] });
          }}
        />
      ) : null}
    </section>
  );
}
