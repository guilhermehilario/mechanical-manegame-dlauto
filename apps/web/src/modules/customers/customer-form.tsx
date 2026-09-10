import { type FormEvent, useState } from 'react';
import { createCustomerSchema, updateCustomerSchema } from '@mechanic-system/validation';
import type { CustomerDto } from '@mechanic-system/types';
import type { CreateCustomerInput } from '@mechanic-system/validation';
import { ApiClientError } from '../../services/api-client';
import { createCustomer, updateCustomer } from '../../services/customers.service';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

interface FieldErrors {
  [field: string]: string | undefined;
}

interface CustomerFormProps {
  customer: CustomerDto | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Presentation only (spec §23): client-side validation reuses the same shared
 * Zod schemas the API enforces; the service layer owns HTTP.
 */
export function CustomerForm({ customer, onClose, onSaved }: CustomerFormProps) {
  const isEdit = customer !== null;
  const [name, setName] = useState(customer?.name ?? '');
  const [cpf, setCpf] = useState(customer?.cpf ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [address, setAddress] = useState(customer?.address ?? '');
  const [notes, setNotes] = useState(customer?.notes ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const raw = { name, cpf, phone, email, address, notes };
    const parsed = isEdit ? updateCustomerSchema.safeParse(raw) : createCustomerSchema.safeParse(raw);
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
        const { name: n, cpf: c, phone: p, email: e, address: a, notes: no } = parsed.data;
        await updateCustomer(customer.id, { name: n, cpf: c, phone: p, email: e, address: a, notes: no });
      } else {
        await createCustomer(parsed.data as CreateCustomerInput);
      }
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'CPF_ALREADY_EXISTS') {
        setFieldErrors({ cpf: 'Este CPF já está cadastrado.' });
      } else {
        setFormError('Não foi possível salvar o cliente. Tente novamente.');
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
          {isEdit ? 'Editar cliente' : 'Novo cliente'}
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

          {field('CPF *', 'cpf', (
            <input
              id="cpf"
              className={inputClass}
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(event) => {
                setCpf(event.target.value);
              }}
              disabled={isSubmitting}
            />
          ), fieldErrors.cpf)}

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
