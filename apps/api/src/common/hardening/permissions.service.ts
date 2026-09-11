import { Injectable, type OnModuleInit } from '@nestjs/common';
import { dirname, resolve } from 'node:path';
import type { Env } from '@mechanic-system/config';
import { hardenDataDirectories } from './permissions';

/**
 * Runs the R7/SEC-07 hardening once at boot, after config validation:
 *  - database directory (SQLite file + WAL/SHM sidecars) → 0700;
 *  - storage dir (images/signatures) → 0700, files 0600;
 *  - backup dir → 0700.
 *
 * DATABASE_URL is `file:<path>` (absolute in the packaged flow, relative to
 * the schema in dev) — the directory is derived from the file part.
 */
@Injectable()
export class PermissionsService implements OnModuleInit {
  constructor(private readonly env: Env) {}

  async onModuleInit(): Promise<void> {
    const databaseDir = databaseDirectory(this.env.DATABASE_URL);
    await hardenDataDirectories(databaseDir, resolve(this.env.STORAGE_DIR), resolve(this.env.BACKUP_DIR));
  }
}

/** Extracts the directory of a Prisma SQLite `file:` URL. */
export function databaseDirectory(databaseUrl: string): string {
  const raw = databaseUrl.startsWith('file:') ? databaseUrl.slice('file:'.length) : databaseUrl;
  // A `?` query (e.g. file:./dev.db?connection_limit=1) is not a path part.
  const path = raw.split('?')[0] ?? raw;
  return dirname(resolve(path));
}
