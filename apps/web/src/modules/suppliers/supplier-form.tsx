import { type FormEvent, useState } from 'react';
import { createSupplierSchema, updateSupplierSchema } from '@mechanic-system/validation';
import type { SupplierDto } from '@mechanic-system/types';
import { ApiClientError } from '../../services/api-client';
import { createSupplier, updateSupplier } from '../../services/catalog.service';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

interface FieldErrors {
  [field: string]: string | undefined;
}

interface SupplierFormProps {
  supplier: SupplierDto | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SupplierForm({ supplier, onClose, onSaved }: SupplierFormProps) {
  const isEdit = supplier !== null;
  const [name, setName] = useState(supplier?.name ?? '');
  const [cnpj, setCnpj] = useState(supplier?.cnpj ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [address, setAddress] = useState(supplier?.address ?? '');
  const [notes, setNotes] = useState(supplier?.notes ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const raw = { name, cnpj, phone, email, address, notes };
    const parsed = isEdit
      ? updateSupplierSchema.safeParse(raw)
      : createSupplierSchema.safeParse(raw);
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
        await updateSupplier(supplier.id, parsed.data);
      } else {
        await createSupplier(parsed.data as Parameters<typeof createSupplier>[0]);
      }
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'CNPJ_ALREADY_EXISTS') {
        setFieldErrors({ cnpj: 'Este CNPJ já está cadastrado.' });
      } else {
        setFormError('Não foi possível salvar o fornecedor. Tente novamente.');
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
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-bold text-slate-900">
          {isEdit ? 'Editar fornecedor' : 'Novo fornecedor'}
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

          {field('CNPJ *', 'cnpj', (
            <input
              id="cnpj"
              className={inputClass}
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(event) => {
                setCnpj(event.target.value);
              }}
              disabled={isSubmitting}
            />
          ), fieldErrors.cnpj)}

          <div className="grid grid-cols-2 gap-4">
            {field('Telefone *', 'phone', (
              <input
                id="phone"
                className={inputClass}
                placeholder="(11) 99999-8888"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.phone)}

            {field('E-mail', 'email', (
              <input
                id="email"
                type="email"
                className={inputClass}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ), fieldErrors.email)}
          </div>

          {field('Endereço', 'address', (
            <input
              id="address"
              className={inputClass}
              value={address}
              onChange={(event) => {
                setAddress(event.target.value);
              }}
              disabled={isSubmitting}
            />
          ), fieldErrors.address)}

          {field('Observações', 'notes', (
            <textarea
              id="notes"
              rows={2}
              className={inputClass}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
              disabled={isSubmitting}
            />
          ), fieldErrors.notes)}

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
