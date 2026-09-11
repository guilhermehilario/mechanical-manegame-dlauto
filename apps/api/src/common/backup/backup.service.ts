import { createHash, randomBytes } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile, chmod } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { Env } from '@mechanic-system/config';
import type { BackupDto, BackupManifest, RestoreResultDto } from '@mechanic-system/types';
import { ErrorCodes } from '@mechanic-system/types';
import { DomainError } from '../errors/domain.error';
import { PrismaService } from '../../prisma/prisma.service';
import { ensurePrivateDir } from '../hardening/permissions';

/**
 * BackupService (Fase 10, spec §3) — local backup/restore of the two places
 * where the shop's data lives:
 *
 *   1. the SQLite database → consistent snapshot via `VACUUM INTO 'path'`
 *      (WAL-safe: SQLite compacts a full copy in one statement — ADR-001's
 *      planned "checkpoint WAL" ADR, implemented here);
 *   2. the storage dir     → full copy of the content-addressed image tree.
 *
 * A backup is a folder `BACKUP_DIR/<id>/` containing `manifest.json`,
 * `database.db` and `storage/`. Restore verifies the manifest + sha256 +
 * `PRAGMA integrity_check`, swaps the live files and reconnects.
 *
 * Backups contain PII → the folder tree is 0700/0600 (R7/SEC-07, ADR-006).
 */

const MANIFEST_FILE = 'manifest.json';
const DATABASE_FILE = 'database.db';
const STORAGE_SUBDIR = 'storage';

interface VacuumRow {
  [column: string]: unknown;
}

interface IntegrityRow {
  [column: string]: unknown;
}

@Injectable()
export class BackupService {
  private readonly backupRoot: string;
  private readonly storageRoot: string;
  private readonly databasePath: string;

  constructor(
    private readonly prisma: PrismaService,
    env: Env,
  ) {
    this.backupRoot = resolve(env.BACKUP_DIR);
    this.storageRoot = resolve(env.STORAGE_DIR);
    this.databasePath = databaseFilePath(env.DATABASE_URL, process.cwd());
  }

  /** Creates a consistent backup folder and returns its descriptor. */
  async create(): Promise<BackupDto> {
    const id = backupId();
    const target = join(this.backupRoot, id);
    await ensurePrivateDir(target);

    try {
      // 1. Consistent SQLite snapshot — the whole path is ONE SQL string.
      await this.prisma.$queryRawUnsafe<VacuumRow[]>(
        `VACUUM INTO '${escapeSqlString(join(target, DATABASE_FILE))}'`,
      );

      // 2. Storage copy (content-addressed tree; dedup keeps it small).
      const storageStats = await copyStorage(this.storageRoot, join(target, STORAGE_SUBDIR));

      // 3. Manifest with integrity data for the future restore.
      const dbStat = await stat(join(target, DATABASE_FILE));
      const manifest: BackupManifest = {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        databaseSha256: await sha256File(join(target, DATABASE_FILE)),
        databaseSizeBytes: dbStat.size,
        storageFiles: storageStats.files,
        storageBytes: storageStats.bytes,
        prismaMigration: await this.currentMigration(),
      };
      await writeFile(join(target, MANIFEST_FILE), JSON.stringify(manifest, null, 2), {
        mode: 0o600,
      });
      await chmod(join(target, MANIFEST_FILE), 0o600).catch(() => undefined);

      return {
        id,
        createdAt: manifest.createdAt,
        sizeBytes: dbStat.size + storageStats.bytes,
        databaseSizeBytes: dbStat.size,
        storageFiles: storageStats.files,
        manifest,
      };
    } catch (error) {
      // Never leave a half-written backup behind.
      await rm(target, { recursive: true, force: true }).catch(() => undefined);
      if (error instanceof DomainError) throw error;
      throw new DomainError(ErrorCodes.INTERNAL_ERROR, 'Falha ao criar o backup local', 500);
    }
  }

  /** Lists available backups, newest first. */
  async list(): Promise<BackupDto[]> {
    await ensurePrivateDir(this.backupRoot);
    const entries = await readdir(this.backupRoot, { withFileTypes: true });
    const backups: BackupDto[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dto = await this.readOne(entry.name).catch(() => null);
      if (dto) backups.push(dto);
    }
    return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Reads a single backup folder (validates the manifest + snapshot). */
  async readOne(id: string): Promise<BackupDto> {
    const target = join(this.backupRoot, sanitizeId(id));
    const manifest = await this.readManifest(target);
    const dbStat = await stat(join(target, DATABASE_FILE)).catch(() => null);
    if (!dbStat) {
      throw new DomainError(ErrorCodes.BACKUP_CORRUPT, 'Backup sem snapshot do banco', 409);
    }
    const storageStats = await treeStats(join(target, STORAGE_SUBDIR));
    return {
      id: sanitizeId(id),
      createdAt: manifest.createdAt,
      sizeBytes: dbStat.size + storageStats.bytes,
      databaseSizeBytes: dbStat.size,
      storageFiles: storageStats.files,
      manifest,
    };
  }

  /** Permanently deletes a backup folder. */
  async remove(id: string): Promise<void> {
    const target = join(this.backupRoot, sanitizeId(id));
    const exists = (await stat(target).catch(() => null)) !== null;
    if (!exists) {
      throw new DomainError(ErrorCodes.BACKUP_NOT_FOUND, 'Backup não encontrado', 404);
    }
    await rm(target, { recursive: true, force: true });
  }

  /**
   * Restores a backup: verifies integrity FIRST, disconnects Prisma, swaps
   * the live database + storage and reconnects. Nothing is touched when the
   * snapshot fails verification.
   */
  async restore(id: string): Promise<RestoreResultDto> {
    const target = join(this.backupRoot, sanitizeId(id));
    const manifest = await this.readManifest(target);

    // 1. Verify the snapshot BEFORE touching the live system.
    const databasePath = join(target, DATABASE_FILE);
    if ((await sha256File(databasePath)) !== manifest.databaseSha256) {
      throw new DomainError(
        ErrorCodes.BACKUP_CORRUPT,
        'Checksum do snapshot não confere — backup corrompido',
        409,
      );
    }
    const integrity = await this.prisma.$queryRawUnsafe<IntegrityRow[]>(
      `PRAGMA integrity_check(${sqlStringLiteral(databasePath)})`,
    );
    const verdict = integrity[0]?.['integrity_check'];
    if (verdict !== 'ok') {
      throw new DomainError(
        ErrorCodes.BACKUP_CORRUPT,
        `Integridade do snapshot inválida: ${String(verdict)}`,
        409,
      );
    }

    // 2. Disconnect so no pooled connection holds the live files.
    await this.prisma.$disconnect();

    try {
      // 3. Swap the database: snapshot → live path (rename within the same
      //    filesystem is atomic). WAL/SHM sidecars must die with the old db.
      const staging = `${this.databasePath}.restore-${Date.now()}`;
      await cp(databasePath, staging, { mode: 0o600 });
      await rm(this.databasePath, { force: true });
      await rm(`${this.databasePath}-wal`, { force: true });
      await rm(`${this.databasePath}-shm`, { force: true });
      await rename(staging, this.databasePath);

      // 4. Swap storage: replace the live tree with the backed-up one.
      const storageBackup = join(target, STORAGE_SUBDIR);
      const hasStorage = (await stat(storageBackup).catch(() => null)) !== null;
      if (hasStorage) {
        await rm(this.storageRoot, { recursive: true, force: true });
        await cp(storageBackup, this.storageRoot, { recursive: true });
      }

      return {
        restoredAt: new Date().toISOString(),
        databaseRestored: true,
        storageRestored: hasStorage,
      };
    } catch (error) {
      throw new DomainError(ErrorCodes.RESTORE_FAILED, 'Falha ao restaurar o backup', 500, {
        cause: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // 5. Reconnect regardless of outcome — the API keeps serving.
      await this.prisma.$connect();
    }
  }

  // ─── internals ────────────────────────────────────────────────────────────

  private async readManifest(target: string): Promise<BackupManifest> {
    const raw = await readFile(join(target, MANIFEST_FILE), 'utf8').catch(() => null);
    if (!raw) {
      throw new DomainError(ErrorCodes.BACKUP_NOT_FOUND, 'Backup não encontrado', 404);
    }
    try {
      return JSON.parse(raw) as BackupManifest;
    } catch {
      throw new DomainError(ErrorCodes.BACKUP_CORRUPT, 'Manifest inválido', 409);
    }
  }

  private async currentMigration(): Promise<string | null> {
    // Read-only SELECT over Prisma's own migrations table.
    const rows = await this.prisma
      .$queryRawUnsafe<Array<{ migration_name: string }>>(
        'SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1',
      )
      .catch(() => [] as Array<{ migration_name: string }>);
    return rows[0]?.migration_name ?? null;
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Backup folder id: timestamp + 6 random hex chars (both safe chars). */
function backupId(): string {
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  return `${stamp}-${randomBytes(3).toString('hex')}`;
}

/** Only [A-Za-z0-9.-] survive — ids are always our own, defense in depth. */
function sanitizeId(id: string): string {
  const safe = id.replace(/[^A-Za-z0-9.-]/g, '');
  if (safe !== id || safe.includes('..')) {
    throw new DomainError(ErrorCodes.VALIDATION_ERROR, 'Identificador de backup inválido', 400);
  }
  return safe;
}

/** Doubles single quotes for a SQLite string literal. */
function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}

/** `'...'` literal with the path escaped — for PRAGMA/integrity arguments. */
function sqlStringLiteral(value: string): string {
  return `'${escapeSqlString(value)}'`;
}

/**
 * Resolves the live SQLite file path from the Prisma `file:` URL.
 * Relative URLs (dev/e2e) resolve against `database/prisma` (where the
 * schema lives) — located by walking up from cwd; absolute URLs (packaged
 * userData) are used as-is.
 */
export function databaseFilePath(databaseUrl: string, cwd: string): string {
  let raw = databaseUrl.startsWith('file:') ? databaseUrl.slice('file:'.length) : databaseUrl;
  raw = raw.split('?')[0] ?? raw;
  if (raw.startsWith('/')) return raw;
  return join(findSchemaDir(cwd), raw);
}

/** Walks up from `start` looking for database/prisma/schema.prisma. */
function findSchemaDir(start: string): string {
  let current = start;
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(current, 'database', 'prisma');
    if (existsSync(join(candidate, 'schema.prisma'))) return candidate;
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  // Fallback: created on demand (packaged flow uses absolute URLs anyway).
  const fallback = join(start, 'database', 'prisma');
  mkdirSync(fallback, { recursive: true });
  return fallback;
}

async function copyStorage(from: string, to: string): Promise<{ files: number; bytes: number }> {
  const before = await treeStats(from);
  await cp(from, to, { recursive: true }).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error; // empty storage → just create the target
    await mkdir(to, { recursive: true });
  });
  return before;
}

async function treeStats(root: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(child);
      } else if (entry.isFile()) {
        const info = await stat(child).catch(() => null);
        if (info) {
          files += 1;
          bytes += info.size;
        }
      }
    }
  };
  await walk(root);
  return { files, bytes };
}

async function sha256File(path: string): Promise<string> {
  const content = await readFile(path);
  return createHash('sha256').update(content).digest('hex');
}
