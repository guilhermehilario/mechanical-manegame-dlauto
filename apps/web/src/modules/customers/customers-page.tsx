import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CustomerDto } from '@mechanic-system/types';
import { ApiClientError } from '../../services/api-client';
import {
  deleteCustomer,
  listCustomers,
} from '../../services/customers.service';
import { CustomerForm } from './customer-form';
import { EmptyTableRow } from '../../components/empty-state';
import { PageHeader } from '../../components/page-header';
import { btnPrimary, btnSecondary, inputClass, tableHead, tableWrap } from '../../components/ui';
import { IconButton, IconActionGroup } from '../../components/icon-button';
import { IconPencil, IconPlus, IconSearch, IconTrash } from '../../components/icons';
import { SortableTh } from '../../components/sortable-th';
import { useTableSort } from '../../hooks/use-table-sort';
import { formatCpf, formatPhone } from '../../utils/format';

/** Mapa coluna → direção natural do primeiro clique. */
const DEFAULT_DIRS = {
  name: 'asc',
  cpf: 'asc',
  phone: 'asc',
  createdAt: 'desc',
} as const;

export function CustomersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [formCustomer, setFormCustomer] = useState<CustomerDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { sort, sortProps } = useTableSort(DEFAULT_DIRS);

  const customersQuery = useQuery({
    queryKey: ['customers', page, submittedSearch, sort],
    queryFn: () =>
      listCustomers({ page, search: submittedSearch || undefined, ...sort }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiClientError
          ? `Erro ao excluir: ${error.message}`
          : 'Erro ao excluir cliente.',
      );
    },
  });

  const items = customersQuery.data?.items ?? [];
  const totalPages = customersQuery.data?.totalPages ?? 1;

  function openNew(): void {
    setFormCustomer(null);
    setIsFormOpen(true);
  }

  function openEdit(customer: CustomerDto): void {
    setFormCustomer(customer);
    setIsFormOpen(true);
  }

  function handleDelete(customer: CustomerDto): void {
    if (window.confirm(`Excluir o cliente "${customer.name}"?`)) {
      deleteMutation.mutate(customer.id);
    }
  }

  return (
    <section>
      <PageHeader
        title="Clientes"
        actions={
          <button type="button" onClick={openNew} className={btnPrimary}>
            <IconPlus className="h-4 w-4" />
            Novo cliente
          </button>
        }
      />

      <form
        className="mb-4 flex flex-col gap-2 sm:flex-row"
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
            placeholder="Buscar por nome, CPF ou telefone…"
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

      {actionError ? (
        <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      <div className={tableWrap}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <SortableTh name="Nome" {...sortProps('name')}>Nome</SortableTh>
              <SortableTh name="CPF" {...sortProps('cpf')}>CPF</SortableTh>
              <SortableTh name="Telefone" {...sortProps('phone')}>Telefone</SortableTh>
              <SortableTh name="Status">Status</SortableTh>
              <SortableTh name="Ações" className="text-right">Ações</SortableTh>
            </tr>
          </thead>
          <tbody>
            {customersQuery.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <EmptyTableRow
                colSpan={5}
                message="Nenhum cliente encontrado."
                actions={
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(true);
                    }}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Cadastrar primeiro cliente
                  </button>
                }
              />
            ) : (
              items.map((customer) => (
                <tr key={customer.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <Link
                      to={`/customers/${customer.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {customer.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatCpf(customer.cpf)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatPhone(customer.phone)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        customer.active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {customer.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <IconActionGroup>
                      <IconButton
                        icon={IconPencil}
                        tone="blue"
                        label={`Editar ${customer.name}`}
                        onClick={() => {
                          openEdit(customer);
                        }}
                      />
                      <IconButton
                        icon={IconTrash}
                        tone="red"
                        label={`Excluir ${customer.name}`}
                        onClick={() => {
                          handleDelete(customer);
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
        <CustomerForm
          customer={formCustomer}
          onClose={() => {
            setIsFormOpen(false);
          }}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['customers'] });
          }}
        />
      ) : null}
    </section>
  );
}
