import { LoginForm } from './login-form';

export function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="mb-1 text-xl font-bold text-slate-900">Sistema da Oficina</h1>
        <p className="mb-6 text-sm text-slate-500">Acesse com sua conta</p>
        <LoginForm />
      </div>
    </main>
  );
}
