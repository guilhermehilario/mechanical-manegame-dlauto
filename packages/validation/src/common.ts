import { z } from 'zod';

/** Maximum page size allowed by the API (spec §25 — backend must cap `limit`). */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export const idSchema = z.string().cuid();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().min(1).max(255).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const sortDirectionSchema = z.enum(['asc', 'desc']).default('desc');
export type SortDirection = z.infer<typeof sortDirectionSchema>;

/**
 * Query sorting (spec §25): optional `sortBy` + `sortDir` accepted by list
 * endpoints. Each module narrows `sortBy` to its own whitelist of columns
 * (never pass raw user input to Prisma orderBy). Omitted `sortBy` keeps the
 * endpoint's default ordering.
 */
export function createSortQuerySchema<TField extends string>(allowedFields: readonly TField[]) {
  return paginationQuerySchema.extend({
    sortBy: z.enum(allowedFields as [TField, ...TField[]]).optional(),
    sortDir: sortDirectionSchema.optional(),
  });
}

export interface SortQuery<TField extends string = string> {
  sortBy?: TField;
  sortDir?: 'asc' | 'desc';
}

/** Whitelisted sort field type helper (e.g. CustomerSortField = 'name' | 'cpf' | …). */
export type SortField<T extends readonly string[]> = T[number];

/** Builds the Prisma `orderBy` from a whitelisted sort query (or the default). */
export function buildOrderBy<TField extends string>(
  sortBy: TField | undefined,
  sortDir: 'asc' | 'desc' | undefined,
  fieldMap: Record<TField, string>,
  defaultOrder: Record<string, 'asc' | 'desc'>,
): Record<string, 'asc' | 'desc'> {
  if (sortBy && sortBy in fieldMap) return { [fieldMap[sortBy]]: sortDir ?? 'asc' };
  return defaultOrder;
}
