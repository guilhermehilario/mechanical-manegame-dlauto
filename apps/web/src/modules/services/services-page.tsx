import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ServiceDto } from '@mechanic-system/types';
import { formatBRL } from '@mechanic-system/shared';
import { ApiClientError } from '../../services/api-client';
import { deleteService, listServices, seedCatalogExample } from '../../services/catalog.service';
import { EmptyTableRow } from '../../components/empty-state';
import { PageHeader } from '../../components/page-header';
import { btnPrimary, btnSecondary, inputClass, linkBtn, linkBtnDanger, tableHead, tableWrap } from '../../components/ui';
import { IconPlus, IconSearch } from '../../components/icons';
import { useAuth } from '../auth/use-auth';
import { ServiceForm } from './service-form';

export function ServicesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [formService, setFormService] = useState<ServiceDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canManageCatalog = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const servicesQuery = useQuery({
    queryKey: ['services', page, submittedSearch],
    queryFn: () => listServices({ page, search: submittedSearch || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiClientError
          ? `Erro ao excluir: ${error.message}`
          : 'Erro ao excluir serviço.',
      );
    },
  });

  const seedMutation = useMutation({
    mutationFn: seedCatalogExample,
    onSuccess: (result) => {
      setActionError(null);
      setNotice(
        `Catálogo de exemplo carregado (${result.services} serviços, ${result.products} produtos, ${result.suppliers} fornecedores).`,
      );
      void queryClient.invalidateQueries({ queryKey: ['services'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: () => {
      setNotice(null);
      setActionError('Não foi possível carregar o catálogo de exemplo.');
    },
  });

  const items = servicesQuery.data?.items ?? [];
  const totalPages = servicesQuery.data?.totalPages ?? 1;

  function handleDelete(service: ServiceDto): void {
    if (window.confirm(`Excluir o serviço "${service.name}"?`)) {
      deleteMutation.mutate(service.id);
    }
  }

  function openCreateForm(): void {
    setFormService(null);
    setIsFormOpen(true);
  }

  return (
    <section>
      <PageHeader
        title="Serviços"
        actions={
          <button type="button" onClick={openCreateForm} className={btnPrimary}>
            <IconPlus className="h-4 w-4" />
            Novo serviço
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
            placeholder="Buscar por nome ou descrição…"
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

      {notice ? (
        <div role="status" className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {notice}
        </div>
      ) : null}

      <div className={tableWrap}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3">Duração</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {servicesQuery.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <EmptyTableRow
                colSpan={5}
                message="Nenhum serviço encontrado."
                actions={
                  <>
                    <button
                      type="button"
                      onClick={openCreateForm}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Criar primeiro serviço
                    </button>
                    {canManageCatalog ? (
                      <button
                        type="button"
                        onClick={() => {
                          seedMutation.mutate();
                        }}
                        disabled={seedMutation.isPending}
                        className="rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                      >
                        {seedMutation.isPending ? 'Carregando…' : 'Carregar catálogo de exemplo'}
                      </button>
                    ) : null}
                  </>
                }
              />
            ) : (
              items.map((service) => (
                <tr key={service.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{service.name}</td>
                  <td className="px-4 py-3 text-slate-600">{formatBRL(service.priceCents)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {service.estimatedMinutes ? `${service.estimatedMinutes} min` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        service.active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {service.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setFormService(service);
                        setIsFormOpen(true);
                      }}
                      className={`${linkBtn} mr-3`}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleDelete(service);
                      }}
                      className={linkBtnDanger}
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
        <ServiceForm
          service={formService}
          onClose={() => {
            setIsFormOpen(false);
          }}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['services'] });
          }}
        />
      ) : null}
    </section>
  );
}
