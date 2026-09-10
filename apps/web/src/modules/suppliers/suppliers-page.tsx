import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupplierDto } from '@mechanic-system/types';
import { ApiClientError } from '../../services/api-client';
import { deleteSupplier, listSuppliers } from '../../services/catalog.service';
import { SupplierForm } from './supplier-form';
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Fornecedores</h1>
        <button
          type="button"
          onClick={() => {
            setFormSupplier(null);
            setIsFormOpen(true);
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Novo fornecedor
        </button>
      </div>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSubmittedSearch(search.trim());
        }}
      >
        <input
          type="search"
          placeholder="Buscar por nome ou CNPJ…"
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

      {actionError ? (
        <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
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
                    <button
                      type="button"
                      onClick={() => {
                        setFormSupplier(supplier);
                        setIsFormOpen(true);
                      }}
                      className="mr-3 text-xs font-medium text-blue-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleDelete(supplier);
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
