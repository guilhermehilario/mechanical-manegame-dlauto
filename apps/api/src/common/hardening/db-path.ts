import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Resolves the live SQLite database file path from a Prisma `file:` URL.
 * Relative URLs (dev/e2e: `file:./dev.db`) resolve against `database/prisma`
 * — the directory containing schema.prisma, exactly where Prisma resolves
 * them. Absolute URLs (packaged userData) are used as-is. Query strings
 * (`file:./dev.db?connection_limit=1`) are stripped.
 */
export function databaseFilePath(databaseUrl: string, cwd: string): string {
  let raw = databaseUrl.startsWith('file:') ? databaseUrl.slice('file:'.length) : databaseUrl;
  raw = raw.split('?')[0] ?? raw;
  if (raw.startsWith('/')) return raw;
  return join(findSchemaDir(cwd), raw);
}

/** Directory of the live database file (for permission hardening, R7). */
export function databaseDirectory(databaseUrl: string, cwd: string): string {
  return dirname(databaseFilePath(databaseUrl, cwd));
}

/** Walks up from `start` looking for database/prisma/schema.prisma. */
function findSchemaDir(start: string): string {
  let current = resolve(start);
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(current, 'database', 'prisma');
    if (existsSync(join(candidate, 'schema.prisma'))) return candidate;
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  // Fallback (packaged flows use absolute URLs): keep a conventional path.
  const fallback = join(resolve(start), 'database', 'prisma');
  mkdirSync(fallback, { recursive: true });
  return fallback;
}
