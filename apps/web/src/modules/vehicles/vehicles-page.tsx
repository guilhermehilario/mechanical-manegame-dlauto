import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VehicleDto } from '@mechanic-system/types';
import { ApiClientError } from '../../services/api-client';
import { deleteVehicle, listVehicles } from '../../services/vehicles.service';
import { listCustomers } from '../../services/customers.service';
import { VehicleForm } from './vehicle-form';
import { PageHeader } from '../../components/page-header';
import { btnPrimary, btnSecondary, inputClass, tableHead, tableWrap } from '../../components/ui';
import { IconButton, IconActionGroup, IconLink } from '../../components/icon-button';
import {
  IconHistory,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '../../components/icons';
import { SortableTh } from '../../components/sortable-th';
import { useTableSort } from '../../hooks/use-table-sort';

const DEFAULT_DIRS = {
  plate: 'asc',
  brand: 'asc',
  model: 'asc',
  year: 'desc',
  createdAt: 'desc',
} as const;

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
  const { sort, sortProps } = useTableSort(DEFAULT_DIRS);

  const customersQuery = useQuery({
    queryKey: ['customers', 'for-filter'],
    queryFn: () => listCustomers({ limit: 100 }),
  });

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', page, submittedSearch, customerFilter, sort],
    queryFn: () =>
      listVehicles({
        page,
        search: submittedSearch || undefined,
        customerId: customerFilter || undefined,
        ...sort,
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
      <PageHeader
        title="Veículos"
        actions={
          <button
            type="button"
            onClick={() => {
              setFormVehicle(null);
              setIsFormOpen(true);
            }}
            className={btnPrimary}
          >
            <IconPlus className="h-4 w-4" />
            Novo veículo
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSubmittedSearch(search.trim());
          }}
        >
          <div className="relative flex-1 sm:max-w-sm">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Buscar por placa, marca ou modelo…"
              className={`${inputClass} pl-9`}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </div>
          <button type="submit" className={btnSecondary}>
            Buscar
          </button>
        </form>
        <select
          className={`${inputClass} sm:max-w-56`}
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

      <div className={tableWrap}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <SortableTh name="Placa" {...sortProps('plate')}>Placa</SortableTh>
              <SortableTh name="Marca" {...sortProps('brand')}>Veículo</SortableTh>
              <SortableTh name="Cliente">Cliente</SortableTh>
              <SortableTh name="Ano" {...sortProps('year')}>Ano</SortableTh>
              <SortableTh name="KM">KM</SortableTh>
              <SortableTh name="Ações" className="text-right">Ações</SortableTh>
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
                    <IconActionGroup>
                      <IconButton
                        icon={IconPencil}
                        tone="blue"
                        label={`Editar ${vehicle.plate}`}
                        onClick={() => {
                          setFormVehicle(vehicle);
                          setIsFormOpen(true);
                        }}
                      />
                      <IconLink
                        icon={IconHistory}
                        to={`/vehicles/${vehicle.id}/history`}
                        label={`Histórico de ${vehicle.plate}`}
                      />
                      <IconButton
                        icon={IconTrash}
                        tone="red"
                        label={`Excluir ${vehicle.plate}`}
                        onClick={() => {
                          handleDelete(vehicle);
                        }}
                      />
                    </IconActionGroup>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
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
            className={btnSecondary}
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => {
              setPage((current) => current + 1);
            }}
            className={btnSecondary}
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
