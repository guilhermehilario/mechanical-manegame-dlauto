import type { ReactNode } from 'react';

/**
 * Consistent empty states (Bloco F/F4): a friendly message and, where it
 * makes sense, a call-to-action to create the first record / load examples.
 */

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ message, actionLabel, onAction }: EmptyStateProps): ReactNode {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <p className="text-sm text-slate-500">{message}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

interface EmptyTableRowProps {
  colSpan: number;
  message: string;
  /** Optional CTAs rendered under the message (e.g. create first record). */
  actions?: ReactNode;
}

export function EmptyTableRow({ colSpan, message, actions }: EmptyTableRowProps): ReactNode {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-500">
        <p>{message}</p>
        {actions ? <div className="mt-3 flex justify-center gap-2">{actions}</div> : null}
      </td>
    </tr>
  );
}