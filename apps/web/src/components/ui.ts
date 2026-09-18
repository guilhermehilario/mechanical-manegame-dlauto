/**
 * Classes de UI compartilhadas para manter consistência visual entre as
 * páginas (botões, inputs, cartões e tabelas) sem dependências extras.
 */

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40';

export const btnPrimary = `inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50 ${focusRing}`;

export const btnSecondary = `inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 ${focusRing}`;

export const btnDanger = `inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 ${focusRing}`;

/** Ações em texto dentro de células de tabela. */
export const linkBtn = 'text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700';
export const linkBtnDanger =
  'text-xs font-semibold text-red-600 transition-colors hover:text-red-700';
export const linkBtnNeutral =
  'text-xs font-semibold text-slate-600 transition-colors hover:text-slate-800';

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

export const selectClass = inputClass;

/** Cartão/painel branco padrão. */
export const card = 'rounded-xl border border-slate-200 bg-white shadow-sm';

/** Container de tabela com scroll horizontal em telas estreitas. */
export const tableWrap = 'overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm';

export const tableHead =
  'border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500';
