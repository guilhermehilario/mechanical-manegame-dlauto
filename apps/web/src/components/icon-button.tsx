import type { ComponentType, ReactNode, SVGProps } from 'react';

/**
 * Botões compactos de ação com tooltip (título + aria-label): otimizam o
 * espaço nas tabelas mantendo acessibilidade — leitores de tela anunciam o
 * `aria-label`, e o tooltip nativo aparece no hover/foco.
 */

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

interface TooltipProps {
  /** Texto do tooltip e do aria-label (nome da ação). */
  label: string;
}

/** Tooltip nativo via `title` (sem dependências; funciona com teclado). */
export function useTooltipProps({ label }: TooltipProps) {
  return {
    title: label,
    'aria-label': label,
  } as const;
}

/**
 * Tons de cor dos ícones de ação — o ícone carrega a cor permanente e o
 * hover apenas reforça com um fundo suave (mesma família da cor).
 */
export type IconButtonTone = 'blue' | 'red' | 'green' | 'amber' | 'neutral';

const TONE_CLASSES: Record<IconButtonTone, string> = {
  blue: 'text-blue-600 hover:bg-blue-50 hover:text-blue-700',
  red: 'text-red-500 hover:bg-red-50 hover:text-red-600',
  green: 'text-green-600 hover:bg-green-50 hover:text-green-700',
  amber: 'text-amber-600 hover:bg-amber-50 hover:text-amber-700',
  neutral: 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
};

interface IconButtonProps extends TooltipProps {
  icon: IconType;
  onClick: () => void;
  /** Cor semântica do ícone (padrão: neutro). */
  tone?: IconButtonTone;
}

export function IconButton({ icon: Icon, onClick, tone = 'neutral', label }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...useTooltipProps({ label })}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${TONE_CLASSES[tone]}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/** Igual ao IconButton, mas renderiza um <Link> do react-router. */
import { Link } from 'react-router-dom';

interface IconLinkProps extends TooltipProps {
  icon: IconType;
  to: string;
  className?: string;
}

export function IconLink({ icon: Icon, to, className = '', label }: IconLinkProps) {
  return (
    <Link
      to={to}
      {...useTooltipProps({ label })}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${className}`}
    >
      <Icon className="h-4 w-4" />
    </Link>
  );
}

/** Grupo de ações de tabela: ícones lado a lado, alinhados à direita. */
export function IconActionGroup({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-0.5">{children}</div>;
}
