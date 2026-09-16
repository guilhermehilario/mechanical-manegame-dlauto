import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../modules/auth/use-auth';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/customers', label: 'Clientes' },
  { to: '/vehicles', label: 'Veículos' },
  { to: '/services', label: 'Serviços' },
  { to: '/products', label: 'Produtos' },
  { to: '/suppliers', label: 'Fornecedores' },
  { to: '/appointments', label: 'Agendamentos' },
  { to: '/work-orders', label: 'Ordens de Serviço' },
  { to: '/pickups', label: 'Retirada/Entrega' },
  { to: '/reports', label: 'Relatórios' },
  { to: '/settings', label: 'Configurações' },
] as const;

/** Admin-only surface (the API enforces the role regardless). */
const ADMIN_NAV_ITEMS = [
  { to: '/backups', label: 'Backups' },
  { to: '/users', label: 'Usuários' },
] as const;

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-sm font-bold text-slate-900">Oficina</p>
          <p className="text-xs text-slate-500">Sistema de Gestão</p>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-blue-50 font-semibold text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {user?.role === 'ADMIN'
            ? ADMIN_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm ${
                      isActive
                        ? 'bg-blue-50 font-semibold text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))
            : null}
        </nav>
        {user ? (
          <div className="border-t border-slate-200 p-4">
            <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <div className="mt-2 flex items-center gap-3">
              <NavLink
                to="/change-password"
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Trocar senha
              </NavLink>
              <button
                type="button"
                onClick={() => {
                  void logout();
                }}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Sair
              </button>
            </div>
          </div>
        ) : null}
      </aside>
      <main className="flex-1 overflow-auto bg-slate-50 p-6">
        <Outlet />
      </main>
    </div>
  );
}
