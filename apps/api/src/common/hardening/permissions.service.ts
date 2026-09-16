import { Injectable, type OnModuleInit } from '@nestjs/common';
import { resolve } from 'node:path';
import type { Env } from '@mechanic-system/config';
import { hardenDataDirectories } from './permissions';
import { databaseDirectory } from './db-path';

/**
 * Runs the R7/SEC-07 hardening once at boot, after config validation:
 *  - database directory (SQLite file + WAL/SHM sidecars) → 0700;
 *  - storage dir (images/signatures) → 0700, files 0600;
 *  - backup dir → 0700.
 */
@Injectable()
export class PermissionsService implements OnModuleInit {
  constructor(private readonly env: Env) {}

  async onModuleInit(): Promise<void> {
    await hardenDataDirectories(
      databaseDirectory(this.env.DATABASE_URL, process.cwd()),
      resolve(this.env.STORAGE_DIR),
      resolve(this.env.BACKUP_DIR),
    );
  }
}
