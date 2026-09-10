import { type FormEvent, useState } from 'react';
import { createServiceSchema, updateServiceSchema } from '@mechanic-system/validation';
import type { ServiceDto } from '@mechanic-system/types';
import { ApiClientError } from '../../services/api-client';
import { createService, updateService } from '../../services/catalog.service';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

interface FieldErrors {
  [field: string]: string | undefined;
}

interface ServiceFormProps {
  service: ServiceDto | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Presentation only (spec 23): price is entered in reais and converted to
 * integer cents before hitting the shared Zod schemas.
 */
export function ServiceForm({ service, onClose, onSaved }: ServiceFormProps) {
  const isEdit = service !== null;
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [price, setPrice] = useState(service ? (service.priceCents / 100).toFixed(2) : '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    service?.estimatedMinutes ? String(service.estimatedMinutes) : '',
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const priceNumber = Number(price.replace(',', '.'));
    const raw = {
      name,
      description,
      priceCents: Number.isFinite(priceNumber) ? Math.round(priceNumber * 100) : price,
      ...(estimatedMinutes ? { estimatedMinutes: Number(estimatedMinutes) } : {}),
    };

    const parsed = isEdit ? updateServiceSchema.safeParse(raw) : createServiceSchema.safeParse(raw);
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
        await updateService(service.id, parsed.data);
      } else {
        await createService(parsed.data as Parameters<typeof createService>[0]);
      }
      onSaved();
      onClose();
    } catch (error) {
      setFormError(
        error instanceof ApiClientError
          ? `Não foi possível salvar o serviço: ${error.message}`
          : 'Erro inesperado. Tente novamente.',
      );
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
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-bold text-slate-900">
          {isEdit ? 'Editar serviço' : 'Novo serviço'}
        </h2>
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="space-y-4"
          noValidate
        >
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
            {field('Preço (R$) *', 'price', (
              <input
                id="price"
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.price)}

            {field('Duração estimada (min)', 'estimatedMinutes', (
              <input
                id="estimatedMinutes"
                type="number"
                min="1"
                className={inputClass}
                value={estimatedMinutes}
                onChange={(event) => {
                  setEstimatedMinutes(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.estimatedMinutes)}
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
