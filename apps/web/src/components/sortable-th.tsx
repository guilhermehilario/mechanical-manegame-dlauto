import type { ReactNode } from 'react';

/**
 * Cabeçalho de coluna ordenável: clicável com indicador de direção (seta).
 * Indicadores visuais coerentes com a tabela padrão do app.
 */

export interface SortableThProps {
  children: ReactNode;
  /** Campo/API name da coluna (usado como title para acessibilidade). */
  name: string;
  sortable?: boolean;
  active?: boolean;
  direction?: 'asc' | 'desc' | null;
  onSort?: () => void;
  /** Classes extras (ex.: alinhamento à direita). */
  className?: string;
}

const baseClass =
  'select-none px-4 py-3';

export function SortableTh({
  children,
  name,
  sortable = false,
  active = false,
  direction = null,
  onSort,
  className = '',
}: SortableThProps) {
  if (!sortable) {
    return <th className={`${baseClass} ${className}`}>{children}</th>;
  }

  const arrow = direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕';

  return (
    <th
      className={`${baseClass} ${className}`}
      aria-sort={
        active ? (direction === 'desc' ? 'descending' : 'ascending') : undefined
      }
    >
      <button
        type="button"
        onClick={onSort}
        title={`Ordenar por ${name}`}
        className={`group inline-flex items-center gap-1 rounded font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
          active ? 'text-slate-900' : 'text-current opacity-80 hover:opacity-100'
        }`}
      >
        {children}
        <span
          aria-hidden="true"
          className={`text-xs transition-opacity ${
            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
          }`}
        >
          {arrow}
        </span>
      </button>
    </th>
  );
}
