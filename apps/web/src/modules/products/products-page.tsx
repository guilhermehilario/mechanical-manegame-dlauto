import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductDto } from '@mechanic-system/types';
import { formatBRL } from '@mechanic-system/shared';
import { ApiClientError } from '../../services/api-client';
import { deleteProduct, listProducts, seedCatalogExample } from '../../services/catalog.service';
import { EmptyTableRow } from '../../components/empty-state';
import { PageHeader } from '../../components/page-header';
import { btnPrimary, btnSecondary, inputClass, linkBtn, linkBtnDanger, linkBtnNeutral, tableHead, tableWrap } from '../../components/ui';
import { IconPlus, IconSearch } from '../../components/icons';
import { useAuth } from '../auth/use-auth';
import { ProductForm } from './product-form';
import { StockMovementForm } from './stock-movement-form';

export function ProductsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [formProduct, setFormProduct] = useState<ProductDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [movementProduct, setMovementProduct] = useState<ProductDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canManageCatalog = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const productsQuery = useQuery({
    queryKey: ['products', page, submittedSearch, lowStockOnly],
    queryFn: () =>
      listProducts({
        page,
        search: submittedSearch || undefined,
        lowStock: lowStockOnly || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiClientError
          ? `Erro ao excluir: ${error.message}`
          : 'Erro ao excluir produto.',
      );
    },
  });

  const items = productsQuery.data?.items ?? [];
  const totalPages = productsQuery.data?.totalPages ?? 1;

  function handleDelete(product: ProductDto): void {
    if (window.confirm(`Excluir o produto "${product.name}"?`)) {
      deleteMutation.mutate(product.id);
    }
  }

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

  return (
    <section>
      <PageHeader
        title="Produtos"
        actions={
          <button
            type="button"
            onClick={() => {
              setFormProduct(null);
              setIsFormOpen(true);
            }}
            className={btnPrimary}
          >
            <IconPlus className="h-4 w-4" />
            Novo produto
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
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
              placeholder="Buscar por código, nome…"
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
        <label className="flex items-center gap-2 text-sm text-slate-600 sm:ml-2">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(event) => {
              setPage(1);
              setLowStockOnly(event.target.checked);
            }}
            className="rounded border-slate-300"
          />
          Somente estoque baixo
        </label>
      </div>

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
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Preço venda</th>
              <th className="px-4 py-3">Estoque</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {productsQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <EmptyTableRow
                colSpan={6}
                message="Nenhum produto encontrado."
                actions={
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setFormProduct(null);
                        setIsFormOpen(true);
                      }}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Criar primeiro produto
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
              items.map((product) => {
                const isLow = product.stockQuantity <= product.minStock;
                return (
                  <tr key={product.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{product.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {product.name}
                      {product.location ? (
                        <span className="ml-2 text-xs text-slate-400">{product.location}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatBRL(product.salePriceCents)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${isLow ? 'text-red-600' : 'text-slate-600'}`}
                      >
                        {product.stockQuantity}
                      </span>
                      <span className="text-xs text-slate-400"> / mín {product.minStock}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          product.active
                            ? 'bg-green-50 text-green-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {product.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setMovementProduct(product);
                        }}
                        className={`${linkBtnNeutral} mr-3`}
                      >
                        Estoque
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormProduct(product);
                          setIsFormOpen(true);
                        }}
                        className={`${linkBtn} mr-3`}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleDelete(product);
                        }}
                        className={linkBtnDanger}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })
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
        <ProductForm
          product={formProduct}
          onClose={() => {
            setIsFormOpen(false);
          }}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['products'] });
          }}
        />
      ) : null}

      {movementProduct ? (
        <StockMovementForm
          product={movementProduct}
          onClose={() => {
            setMovementProduct(null);
          }}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['products'] });
            void queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
          }}
        />
      ) : null}
    </section>
  );
}
