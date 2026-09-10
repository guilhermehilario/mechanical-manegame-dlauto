import { type FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createProductSchema, updateProductSchema } from '@mechanic-system/validation';
import type { ProductDto } from '@mechanic-system/types';
import { ApiClientError } from '../../services/api-client';
import { createProduct, listSuppliers, updateProduct } from '../../services/catalog.service';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

interface FieldErrors {
  [field: string]: string | undefined;
}

interface ProductFormProps {
  product: ProductDto | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Presentation only (spec 23): prices are entered in reais and converted to
 * integer cents. Stock quantity is only settable at creation — afterwards it
 * changes exclusively via stock movements (spec 36).
 */
export function ProductForm({ product, onClose, onSaved }: ProductFormProps) {
  const isEdit = product !== null;
  const [code, setCode] = useState(product?.code ?? '');
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [costPrice, setCostPrice] = useState(
    product ? (product.costPriceCents / 100).toFixed(2) : '',
  );
  const [salePrice, setSalePrice] = useState(
    product ? (product.salePriceCents / 100).toFixed(2) : '',
  );
  const [stockQuantity, setStockQuantity] = useState('0');
  const [minStock, setMinStock] = useState(product ? String(product.minStock) : '0');
  const [location, setLocation] = useState(product?.location ?? '');
  const [supplierId, setSupplierId] = useState(product?.supplierId ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'for-select'],
    queryFn: () => listSuppliers({ limit: 100 }),
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const toCents = (value: string): number | string => {
      const number = Number(value.replace(',', '.'));
      return Number.isFinite(number) ? Math.round(number * 100) : value;
    };

    const raw: Record<string, unknown> = {
      code,
      name,
      description,
      costPriceCents: toCents(costPrice),
      salePriceCents: toCents(salePrice),
      minStock: minStock === '' ? 0 : Number(minStock),
      location,
      supplierId,
    };
    if (!isEdit) {
      raw.stockQuantity = stockQuantity === '' ? 0 : Number(stockQuantity);
    }

    const parsed = isEdit
      ? updateProductSchema.safeParse(raw)
      : createProductSchema.safeParse(raw);
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
        const { code: c, name: n, ...rest } = parsed.data;
        await updateProduct(product.id, { code: c, name: n, ...rest });
      } else {
        await createProduct(parsed.data as Parameters<typeof createProduct>[0]);
      }
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'PRODUCT_CODE_ALREADY_EXISTS') {
        setFieldErrors({ code: 'Este código já está cadastrado.' });
      } else if (error instanceof ApiClientError && error.code === 'SUPPLIER_NOT_FOUND') {
        setFieldErrors({ supplierId: 'Fornecedor não encontrado.' });
      } else {
        setFormError('Não foi possível salvar o produto. Tente novamente.');
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
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-bold text-slate-900">
          {isEdit ? 'Editar produto' : 'Novo produto'}
        </h2>
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            {field('Código *', 'code', (
              <input
                id="code"
                className={inputClass}
                placeholder="Ex.: FIL-001"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase());
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.code)}

            {field('Nome *', 'name', (
              <input
                id="name"
                className={inputClass}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.name)}
          </div>

          {field('Descrição', 'description', (
            <textarea
              id="description"
              rows={2}
              className={inputClass}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              disabled={isSubmitting}
            />
          ), fieldErrors.description)}

          <div className="grid grid-cols-2 gap-4">
            {field('Preço de custo (R$) *', 'costPrice', (
              <input
                id="costPrice"
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={costPrice}
                onChange={(event) => {
                  setCostPrice(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.costPriceCents)}

            {field('Preço de venda (R$) *', 'salePrice', (
              <input
                id="salePrice"
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={salePrice}
                onChange={(event) => {
                  setSalePrice(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.salePriceCents)}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {isEdit ? (
              <div>
                <span className="mb-1 block text-sm font-medium text-slate-700">Estoque atual</span>
                <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {product.stockQuantity} un.{' '}
                  <span className="text-xs text-slate-400">
                    (altere via movimentação de estoque)
                  </span>
                </p>
              </div>
            ) : (
              field('Estoque inicial *', 'stockQuantity', (
                <input
                  id="stockQuantity"
                  type="number"
                  min="0"
                  className={inputClass}
                  value={stockQuantity}
                  onChange={(event) => {
                    setStockQuantity(event.target.value);
                  }}
                  disabled={isSubmitting}
                />
              ), fieldErrors.stockQuantity)
            )}

            {field('Estoque mínimo', 'minStock', (
              <input
                id="minStock"
                type="number"
                min="0"
                className={inputClass}
                value={minStock}
                onChange={(event) => {
                  setMinStock(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.minStock)}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field('Localização', 'location', (
              <input
                id="location"
                className={inputClass}
                placeholder="Ex.: Prateleira A3"
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.location)}

            {field('Fornecedor', 'supplierId', (
              <select
                id="supplierId"
                className={inputClass}
                value={supplierId}
                onChange={(event) => {
                  setSupplierId(event.target.value);
                }}
                disabled={isSubmitting}
              >
                <option value="">— Nenhum —</option>
                {(suppliersQuery.data?.items ?? []).map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            ), fieldErrors.supplierId)}
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
