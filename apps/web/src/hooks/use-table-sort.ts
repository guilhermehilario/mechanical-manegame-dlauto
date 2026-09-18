import { useState } from 'react';

/**
 * Server-side table sorting (spec §25): the header state maps 1:1 to the
 * `sortBy`/`sortDir` query params accepted by the list endpoints. Clicking a
 * column toggles asc → desc → asc; the first click uses the column's natural
 * default direction.
 */

export interface SortState<TField extends string> {
  sortBy?: TField;
  sortDir?: 'asc' | 'desc';
}

export interface UseTableSortResult<TField extends string> {
  /** Current query fragment to spread into the list call. */
  sort: SortState<TField>;
  /** Props for each sortable column header. */
  sortProps: (field: TField) => {
    sortable: true;
    active: boolean;
    direction: 'asc' | 'desc' | null;
    onSort: () => void;
  };
  /** Resets to the default (no explicit sort). */
  reset: () => void;
}

export function useTableSort<TField extends string>(
  defaultDirection: Record<TField, 'asc' | 'desc'>,
): UseTableSortResult<TField> {
  const [state, setState] = useState<SortState<TField>>({});

  function toggle(field: TField): void {
    setState((current) => {
      if (current.sortBy !== field) {
        return { sortBy: field, sortDir: defaultDirection[field] };
      }
      // Toggle: asc → desc → asc …
      const next = current.sortDir === 'asc' ? 'desc' : 'asc';
      return { sortBy: field, sortDir: next };
    });
  }

  return {
    sort: state,
    sortProps: (field) => ({
      sortable: true as const,
      active: state.sortBy === field,
      direction: state.sortBy === field ? (state.sortDir ?? 'asc') : null,
      onSort: () => {
        toggle(field);
      },
    }),
    reset: () => {
      setState({});
    },
  };
}
