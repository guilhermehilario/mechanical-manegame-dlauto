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
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        {needsSetup === null ? (
          <>
            <h1 className="mb-1 text-xl font-bold text-slate-900">Sistema da Oficina</h1>
            <p className="text-sm text-slate-500">Carregando…</p>
          </>
        ) : needsSetup ? (
          <>
            <h1 className="mb-1 text-xl font-bold text-slate-900">Bem-vindo!</h1>
            <p className="mb-6 text-sm text-slate-500">
              Crie o acesso do administrador para começar.
            </p>
            <FirstAccessForm onAlreadyConfigured={() => { setNeedsSetup(false); }} />
          </>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-bold text-slate-900">Sistema da Oficina</h1>
            <p className="mb-6 text-sm text-slate-500">Acesse com sua conta</p>
            <LoginForm />
          </>
        )}
      </div>
    </main>
  );
}
