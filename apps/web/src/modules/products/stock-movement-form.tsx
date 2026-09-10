import { type FormEvent, useState } from 'react';
import { createStockMovementSchema } from '@mechanic-system/validation';
import type { ProductDto, StockMovementDto } from '@mechanic-system/types';
import { ApiClientError } from '../../services/api-client';
import { registerStockMovement } from '../../services/catalog.service';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

interface FieldErrors {
  [field: string]: string | undefined;
}

interface StockMovementFormProps {
  product: ProductDto;
  onClose: () => void;
  onSaved: (movement: StockMovementDto) => void;
}

const TYPE_LABELS: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Saída',
  ADJUSTMENT: 'Ajuste (define o total)',
};

/**
 * Stock movement modal (spec 36): the only way to change stock after
 * creation. ADJUSTMENT defines the new absolute total; IN/OUT take a delta.
 */
export function StockMovementForm({ product, onClose, onSaved }: StockMovementFormProps) {
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const raw = {
      productId: product.id,
      type,
      quantity: quantity === '' ? quantity : Number(quantity),
      reason,
    };

    const parsed = createStockMovementSchema.safeParse(raw);
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
      const movement = await registerStockMovement(parsed.data);
      onSaved(movement);
      onClose();
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'INSUFFICIENT_STOCK') {
        setFormError(error.message);
      } else {
        setFormError('Não foi possível registrar a movimentação. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-base font-bold text-slate-900">Movimentação de estoque</h2>
        <p className="mb-4 text-sm text-slate-500">
          {product.name} — atual: {product.stockQuantity} un.
        </p>
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="space-y-4"
          noValidate
        >
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Tipo *</span>
            <div className="grid grid-cols-3 gap-2">
              {(['IN', 'OUT', 'ADJUSTMENT'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setType(option);
                  }}
                  className={`rounded-md border px-2 py-2 text-xs font-medium ${
                    type === option
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {TYPE_LABELS[option]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="quantity" className="mb-1 block text-sm font-medium text-slate-700">
              {type === 'ADJUSTMENT' ? 'Novo total *' : 'Quantidade *'}
            </label>
            <input
              id="quantity"
              type="number"
              min="0"
              className={inputClass}
              value={quantity}
              onChange={(event) => {
                setQuantity(event.target.value);
              }}
              disabled={isSubmitting}
            />
            {fieldErrors.quantity ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.quantity}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="reason" className="mb-1 block text-sm font-medium text-slate-700">
              Motivo *
            </label>
            <input
              id="reason"
              className={inputClass}
              placeholder="Ex.: Compra (NF 123), peça usada em OS…"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
              disabled={isSubmitting}
            />
            {fieldErrors.reason ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.reason}</p>
            ) : null}
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
              {isSubmitting ? 'Registrando…' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
