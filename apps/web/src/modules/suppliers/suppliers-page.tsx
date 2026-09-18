import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupplierDto } from '@mechanic-system/types';
import { ApiClientError } from '../../services/api-client';
import { deleteSupplier, listSuppliers } from '../../services/catalog.service';
import { SupplierForm } from './supplier-form';
import { PageHeader } from '../../components/page-header';
import { btnPrimary, btnSecondary, inputClass, tableHead, tableWrap } from '../../components/ui';
import { IconButton, IconActionGroup } from '../../components/icon-button';
import { IconPencil, IconPlus, IconSearch, IconTrash } from '../../components/icons';
import { formatCnpj, formatPhone } from '../../utils/format';

export function SuppliersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [formSupplier, setFormSupplier] = useState<SupplierDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', page, submittedSearch],
    queryFn: () => listSuppliers({ page, search: submittedSearch || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiClientError
          ? `Erro ao excluir: ${error.message}`
          : 'Erro ao excluir fornecedor.',
      );
    },
  });

  const items = suppliersQuery.data?.items ?? [];
  const totalPages = suppliersQuery.data?.totalPages ?? 1;

  function handleDelete(supplier: SupplierDto): void {
    if (window.confirm(`Excluir o fornecedor "${supplier.name}"?`)) {
      deleteMutation.mutate(supplier.id);
    }
  }

  return (
    <section>
      <PageHeader
        title="Fornecedores"
        actions={
          <button
            type="button"
            onClick={() => {
              setFormSupplier(null);
              setIsFormOpen(true);
            }}
            className={btnPrimary}
          >
            <IconPlus className="h-4 w-4" />
            Novo fornecedor
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
            placeholder="Buscar por nome ou CNPJ…"
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
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {suppliersQuery.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Nenhum fornecedor encontrado.
                </td>
              </tr>
            ) : (
              items.map((supplier) => (
                <tr key={supplier.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{supplier.name}</td>
                  <td className="px-4 py-3 text-slate-600">{formatCnpj(supplier.cnpj)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatPhone(supplier.phone)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        supplier.active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {supplier.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <IconActionGroup>
                      <IconButton
                        icon={IconPencil}
                        tone="blue"
                        label={`Editar ${supplier.name}`}
                        onClick={() => {
                          setFormSupplier(supplier);
                          setIsFormOpen(true);
                        }}
                      />
                      <IconButton
                        icon={IconTrash}
                        tone="red"
                        label={`Excluir ${supplier.name}`}
                        onClick={() => {
                          handleDelete(supplier);
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
        <SupplierForm
          supplier={formSupplier}
          onClose={() => {
            setIsFormOpen(false);
          }}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
          }}
        />
      ) : null}
    </section>
  );
}
