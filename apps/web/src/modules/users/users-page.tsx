import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserDto } from '@mechanic-system/types';
import { createUserSchema } from '@mechanic-system/validation';
import { ApiClientError } from '../../services/api-client';
import {
  adminResetPassword,
  createUser,
  deactivateUser,
  listUsers,
} from '../../services/users.service';
import { useAuth } from '../auth/use-auth';
import { formatDate } from '../../utils/format';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const ROLE_LABELS: Record<UserDto['role'], string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  MECHANIC: 'Mecânico',
  ATTENDANT: 'Atendente',
};

interface PasswordResetState {
  user: UserDto;
  password: string;
}

/**
 * Users management (Bloco D/D2) — the API already had GET/POST/DELETE /users,
 * but there was no screen: creating staff accounts required database access.
 * ADMIN-only page (API enforces roles; AppLayout hides the nav entry).
 */
export function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [passwordReset, setPasswordReset] = useState<PasswordResetState | null>(null);

  // Backend scopes: listing allows ADMIN/MANAGER; create, deactivate and
  // password reset are ADMIN-only (and reset targets must be ADMIN/MANAGER).
  const canManageUsers = currentUser?.role === 'ADMIN';

  const usersQuery = useQuery({
    queryKey: ['users', page, submittedSearch],
    queryFn: () => listUsers({ page, search: submittedSearch || undefined }),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: (_data, deactivatedId) => {
      setActionError(null);
      setActionSuccess('Usuário desativado.');
      if (passwordReset?.user.id === deactivatedId) setPasswordReset(null);
      invalidate();
    },
    onError: (error) => {
      setActionSuccess(null);
      setActionError(
        error instanceof ApiClientError ? error.message : 'Erro ao desativar o usuário.',
      );
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      adminResetPassword(id, password),
    onSuccess: () => {
      setPasswordReset(null);
      setActionError(null);
      setActionSuccess('Senha redefinida. O usuário precisará entrar com a nova senha.');
    },
    onError: (error) => {
      setActionSuccess(null);
      setActionError(
        error instanceof ApiClientError
          ? error.message
          : 'Erro ao redefinir a senha do usuário.',
      );
    },
  });

  const items = usersQuery.data?.items ?? [];
  const totalPages = usersQuery.data?.totalPages ?? 1;

  function handleDeactivate(user: UserDto): void {
    if (window.confirm(`Desativar o usuário "${user.name}"? O login dele será bloqueado.`)) {
      deactivateMutation.mutate(user.id);
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500">
            Contas de acesso ao sistema. Desativar não apaga o histórico de ações.
          </p>
        </div>
        {canManageUsers ? (
          <button
            type="button"
            onClick={() => {
              setIsFormOpen(true);
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Novo usuário
          </button>
        ) : null}
      </div>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          setPage(1);
          setSubmittedSearch(search.trim());
        }}
      >
        <input
          type="search"
          placeholder="Buscar por nome ou e-mail…"
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
      {actionSuccess ? (
        <div className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {actionSuccess}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Criado em</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              items.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[user.role]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {user.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {canManageUsers &&
                    (user.role === 'ADMIN' || user.role === 'MANAGER') ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordReset({ user, password: '' });
                        }}
                        className="mr-3 text-xs font-medium text-blue-600 hover:underline"
                      >
                        Redefinir senha
                      </button>
                    ) : null}
                    {canManageUsers && user.active ? (
                      <button
                        type="button"
                        onClick={() => {
                          handleDeactivate(user);
                        }}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Desativar
                      </button>
                    ) : null}
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
        <UserFormModal
          onClose={() => {
            setIsFormOpen(false);
          }}
          onSaved={() => {
            setActionError(null);
            setActionSuccess('Usuário criado.');
            invalidate();
          }}
        />
      ) : null}

      {passwordReset ? (
        <PasswordResetModal
          user={passwordReset.user}
          password={passwordReset.password}
          pending={resetPasswordMutation.isPending}
          onPasswordChange={(password) => {
            setPasswordReset({ ...passwordReset, password });
          }}
          onClose={() => {
            setPasswordReset(null);
          }}
          onSubmit={() => {
            resetPasswordMutation.mutate({
              id: passwordReset.user.id,
              password: passwordReset.password,
            });
          }}
        />
      ) : null}
    </section>
  );
}

function UserFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserDto['role']>('ATTENDANT');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = createUserSchema.safeParse({ name, email, password, role });
    if (!parsed.success) {
      const errors: Record<string, string | undefined> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && !errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await createUser(parsed.data);
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'EMAIL_ALREADY_EXISTS') {
        setFieldErrors({ email: 'Este e-mail já está cadastrado.' });
      } else {
        setFormError('Não foi possível criar o usuário. Tente novamente.');
      }
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
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-bold text-slate-900">Novo usuário</h2>
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

          {field('E-mail *', 'email', (
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

          {field(
            'Senha * (mín. 8 caracteres, com letra e número)',
            'password',
            (
              <input
                id="password"
                type="password"
                className={inputClass}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
                disabled={isSubmitting}
              />
            ),
            fieldErrors.password,
          )}

          {field('Papel *', 'role', (
            <select
              id="role"
              className={inputClass}
              value={role}
              onChange={(event) => {
                setRole(event.target.value as UserDto['role']);
              }}
              disabled={isSubmitting}
            >
              <option value="ATTENDANT">Atendente</option>
              <option value="MECHANIC">Mecânico</option>
              <option value="MANAGER">Gerente</option>
              <option value="ADMIN">Administrador</option>
            </select>
          ), fieldErrors.role)}

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
              {isSubmitting ? 'Salvando…' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PasswordResetModalProps {
  user: UserDto;
  password: string;
  pending: boolean;
  onPasswordChange: (password: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

function PasswordResetModal({
  user,
  password,
  pending,
  onPasswordChange,
  onClose,
  onSubmit,
}: PasswordResetModalProps) {
  const valid = createUserSchema.shape.password.safeParse(password).success;

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-base font-bold text-slate-900">Redefinir senha</h2>
        <p className="mt-1 text-sm text-slate-600">
          Defina uma nova senha para <strong>{user.name}</strong>. As sessões ativas do usuário
          serão encerradas.
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (valid) onSubmit();
          }}
          noValidate
        >
          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slate-700">
              Nova senha (mín. 8 caracteres, com letra e número)
            </label>
            <input
              id="new-password"
              type="password"
              className={inputClass}
              value={password}
              onChange={(event) => {
                onPasswordChange(event.target.value);
              }}
              disabled={pending}
              autoFocus
            />
            {password !== '' && !valid ? (
              <p className="mt-1 text-xs text-red-600">
                A senha deve ter ao menos 8 caracteres, com letra e número.
              </p>
            ) : null}
          </div>

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
              disabled={!valid || pending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? 'Salvando…' : 'Redefinir senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
