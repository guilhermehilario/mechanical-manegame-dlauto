import { type FormEvent, useState } from 'react';
import { setupAdminSchema } from '@mechanic-system/validation';
import { ApiClientError } from '../../services/api-client';
import { setupFirstAdmin } from '../../services/auth.service';
import { useAuth } from './use-auth';

interface FirstAccessFormProps {
  /** Called when the API reports setup already done (409) — the page then
   * falls back to the login form. */
  onAlreadyConfigured?: () => void;
}

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

/**
 * First-access screen (Bloco F/F1). Presentation only: validation via the
 * shared schema, admin creation via the service, then a normal login so the
 * user lands authenticated without retyping credentials.
 */
export function FirstAccessForm({ onAlreadyConfigured }: FirstAccessFormProps) {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = setupAdminSchema.safeParse({ name, email, password });
    const errors: FieldErrors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'name' && !errors.name) errors.name = issue.message;
        if (field === 'email' && !errors.email) errors.email = issue.message;
        if (field === 'password' && !errors.password) errors.password = issue.message;
      }
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'As senhas não conferem.';
    }
    if (!parsed.success || errors.confirmPassword) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await setupFirstAdmin(parsed.data);
      await login({ email: parsed.data.email, password: parsed.data.password });
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'SETUP_ALREADY_COMPLETED') {
        onAlreadyConfigured?.();
        return;
      }
      setFormError('Não foi possível concluir a configuração. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="space-y-4"
      noValidate
    >
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
          Seu nome
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          className={inputClass}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          disabled={isSubmitting}
        />
        {fieldErrors.name ? <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p> : null}
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          className={inputClass}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          disabled={isSubmitting}
        />
        {fieldErrors.email ? <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p> : null}
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
          Senha
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className={inputClass}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          disabled={isSubmitting}
        />
        {fieldErrors.password ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-slate-700">
          Confirmar senha
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          className={inputClass}
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
          }}
          disabled={isSubmitting}
        />
        {fieldErrors.confirmPassword ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
        ) : null}
      </div>

      {formError ? (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Criando acesso…' : 'Criar acesso'}
      </button>
    </form>
  );
}
