import { useEffect, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../modules/auth/use-auth';
import {
  IconCalendar,
  IconCar,
  IconChart,
  IconClipboard,
  IconDashboard,
  IconDatabase,
  IconKey,
  IconLogout,
  IconMenu,
  IconPackage,
  IconSettings,
  IconShield,
  IconTruck,
  IconUsers,
  IconWrench,
  IconX,
} from '../../components/icons';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  end?: boolean;
}

type NavGroup = { title: string; items: NavItem[] };

const MAIN_NAV: NavGroup[] = [
  {
    title: 'Visão geral',
    items: [{ to: '/', label: 'Dashboard', icon: IconDashboard, end: true }],
  },
  {
    title: 'Atendimento',
    items: [
      { to: '/customers', label: 'Clientes', icon: IconUsers },
      { to: '/vehicles', label: 'Veículos', icon: IconCar },
      { to: '/appointments', label: 'Agendamentos', icon: IconCalendar },
      { to: '/work-orders', label: 'Ordens de Serviço', icon: IconClipboard },
      { to: '/pickups', label: 'Retirada/Entrega', icon: IconKey },
    ],
  },
  {
    title: 'Estoque e catálogo',
    items: [
      { to: '/services', label: 'Serviços', icon: IconWrench },
      { to: '/products', label: 'Produtos', icon: IconPackage },
      { to: '/suppliers', label: 'Fornecedores', icon: IconTruck },
    ],
  },
  {
    title: 'Gestão',
    items: [{ to: '/reports', label: 'Relatórios', icon: IconChart }],
  },
];

/** Admin-only surface (the API enforces the role regardless). */
const ADMIN_NAV: NavGroup = {
  title: 'Administração',
  items: [
    { to: '/backups', label: 'Backups', icon: IconDatabase },
    { to: '/users', label: 'Usuários', icon: IconShield },
  ],
};

const SETTINGS_ITEM: NavItem = { to: '/settings', label: 'Configurações', icon: IconSettings };

const navLinkClass = (isActive: boolean): string =>
  [
    'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-blue-600 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ');

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
        <IconWrench className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight text-slate-900">
          Oficina
        </span>
        <span className="block truncate text-xs leading-tight text-slate-500">
          Sistema de Gestão
        </span>
      </span>
    </div>
  );
}

function NavSection({ groups }: { groups: NavGroup[] }) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end ?? false}
                  className={({ isActive }) => navLinkClass(isActive)}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function SidebarFooter({
  name,
  email,
  onNavigate,
  onLogout,
}: {
  name: string;
  email: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="border-t border-slate-200 p-3">
      <div className="mb-1 flex items-center gap-2 px-1">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          {name
            .split(' ')
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('') || '?'}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-800">{name}</span>
          <span className="block truncate text-xs text-slate-500">{email}</span>
        </span>
      </div>
      <div className="flex items-center gap-1">
        <NavLink
          to="/change-password"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
              isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`
          }
        >
          <IconKey className="h-3.5 w-3.5" />
          Trocar senha
        </NavLink>
        <button
          type="button"
          onClick={onLogout}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <IconLogout className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Fecha a gaveta mobile se a viewport crescer para desktop.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const onChange = (event: MediaQueryListEvent): void => {
      if (event.matches) setIsMenuOpen(false);
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, []);

  const groups = user?.role === 'ADMIN' ? [...MAIN_NAV, ADMIN_NAV] : MAIN_NAV;

  function closeMenu(): void {
    setIsMenuOpen(false);
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* ── Sidebar fixa (desktop) ─────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-4">
          <Brand />
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Navegação principal">
          <NavSection groups={groups} />
          <div className="mt-4 border-t border-slate-100 pt-1">
            <NavLink to={SETTINGS_ITEM.to} className={({ isActive }) => navLinkClass(isActive)}>
              <SETTINGS_ITEM.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{SETTINGS_ITEM.label}</span>
            </NavLink>
          </div>
        </nav>
        {user ? (
          <SidebarFooter
            name={user.name}
            email={user.email}
            onLogout={() => {
              void logout();
            }}
          />
        ) : null}
      </aside>

      {/* ── Coluna principal ───────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar mobile */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(true);
              }}
              className="-ml-2 rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="Abrir menu"
              aria-expanded={isMenuOpen}
            >
              <IconMenu className="h-5 w-5" />
            </button>
            <Brand />
          </div>
        </header>

        {/* Gaveta de navegação (mobile) */}
        {isMenuOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={closeMenu}
              className="absolute inset-0 h-full w-full cursor-default bg-slate-900/50"
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4">
                <Brand />
                <button
                  type="button"
                  onClick={closeMenu}
                  className="-mr-2 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
                  aria-label="Fechar menu"
                >
                  <IconX className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Navegação">
                <NavSection groups={groups} />
                <div className="mt-4 border-t border-slate-100 pt-1">
                  <NavLink
                    to={SETTINGS_ITEM.to}
                    onClick={closeMenu}
                    className={({ isActive }) => navLinkClass(isActive)}
                  >
                    <SETTINGS_ITEM.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="truncate">{SETTINGS_ITEM.label}</span>
                  </NavLink>
                </div>
              </nav>
              {user ? (
                <SidebarFooter
                  name={user.name}
                  email={user.email}
                  onNavigate={closeMenu}
                  onLogout={() => {
                    void logout();
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Conteúdo */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
