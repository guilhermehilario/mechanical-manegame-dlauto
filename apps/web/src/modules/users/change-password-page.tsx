import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePasswordSchema } from '@mechanic-system/validation';
import { changeMyPassword } from '../../services/users.service';
import { authStore } from '../../services/auth-store';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

/**
 * Self-service password change (Bloco D/D3) — any authenticated role.
 * After success the API revokes every refresh token of this user, so we log
 * the user out and send them back to the login screen with a clean state.
 */
export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      const errors: Record<string, string | undefined> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && !errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'As senhas não conferem.' });
      return;
    }
    if (currentPassword === newPassword) {
      setFieldErrors({ newPassword: 'A nova senha deve ser diferente da atual.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await changeMyPassword(currentPassword, newPassword);
      // Server revoked all refresh tokens — drop the local session cleanly.
      authStore.clear();
      void navigate('/login', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof Error && error.message.length > 0 && error.name === 'ApiClientError'
          ? error.message
          : 'Não foi possível alterar a senha. Verifique a senha atual e tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function field(
    label: string,
    id: string,
    node: React.ReactNode,
    error?: string,
  ): React.ReactNode {
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
    <section className="mx-auto max-w-md">
      <h1 className="text-lg font-bold text-slate-900">Trocar senha</h1>
      <p className="mb-4 text-sm text-slate-500">
        Após trocar a senha você será desconectado e deverá entrar novamente.
      </p>

      <form
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        noValidate
      >
        {field('Senha atual', 'current-password', (
          <input
            id="current-password"
            type="password"
            className={inputClass}
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
            }}
            disabled={isSubmitting}
            autoFocus
          />
        ), fieldErrors.currentPassword)}

        {field('Nova senha (mín. 8 caracteres, com letra e número)', 'new-password', (
          <input
            id="new-password"
            type="password"
            className={inputClass}
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
            }}
            disabled={isSubmitting}
          />
        ), fieldErrors.newPassword)}

        {field('Confirmar nova senha', 'confirm-password', (
          <input
            id="confirm-password"
            type="password"
            className={inputClass}
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
            }}
            disabled={isSubmitting}
          />
        ), fieldErrors.confirmPassword)}

        {formError ? (
          <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              void navigate(-1);
            }}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando…' : 'Trocar senha'}
          </button>
        </div>
      </form>
    </section>
  );
}
