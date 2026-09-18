import { useEffect, useState } from 'react';
import { getSetupStatus } from '../../services/auth.service';
import { FirstAccessForm } from './first-access-form';
import { LoginForm } from './login-form';

/**
 * Entry screen (F1): asks the API whether an active ADMIN exists. While the
 * database is empty the first-access form is shown instead of the login form.
 * On any status error we fall back to login so the user can retry there.
 */
export function LoginPage() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    getSetupStatus()
      .then((status) => {
        if (active) setNeedsSetup(status.needsSetup);
      })
      .catch(() => {
        if (active) setNeedsSetup(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden
            >
              <path d="M14.7 6.3a4.5 4.5 0 0 0 6 6L17 16l-8.5 8.5a2.1 2.1 0 0 1-3-3L14 13l-1.7-1.7" transform="scale(0.82) translate(2.5 -1)" />
            </svg>
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Sistema da Oficina</h1>
          <p className="text-sm text-slate-500">Gestão de clientes, OS e estoque</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {needsSetup === null ? (
            <p className="text-sm text-slate-500">Carregando…</p>
          ) : needsSetup ? (
            <>
              <h2 className="mb-1 text-base font-semibold text-slate-900">Bem-vindo!</h2>
              <p className="mb-6 text-sm text-slate-500">
                Crie o acesso do administrador para começar.
              </p>
              <FirstAccessForm onAlreadyConfigured={() => { setNeedsSetup(false); }} />
            </>
          ) : (
            <LoginForm />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Uso interno da oficina · {new Date().getFullYear()}
        </p>
      </div>
    </main>
  );
}
