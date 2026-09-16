import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BackupService } from '../src/common/backup/backup.service';
import { databaseFilePath } from '../src/common/hardening/db-path';
import {
  ensurePrivateDir,
  hardenTree,
  modeOf,
} from '../src/common/hardening/permissions';
import { databaseDirectory } from '../src/common/hardening/db-path';
import { DomainError } from '../src/common/errors/domain.error';

/**
 * Fase 10 — backup/restore + R7/SEC-07 permission hardening.
 * Real filesystem in a temp dir; Prisma is mocked (the service only uses
 * $queryRawUnsafe for VACUUM INTO / integrity_check and $disconnect/$connect).
 */

let baseDir: string;
let storageDir: string;
let backupDir: string;

beforeAll(async () => {
  baseDir = await mkdtemp(join(tmpdir(), 'mechanic-backup-'));
  storageDir = join(baseDir, 'storage');
  backupDir = join(baseDir, 'backups');
  await mkdir(storageDir, { recursive: true });
});

afterAll(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

function prismaMock() {
  return {
    $queryRawUnsafe: vi.fn(async (sql: string) => {
      // Emulate SQLite: create the VACUUM INTO target file.
      const vacuum = /VACUUM INTO '(.+)'/.exec(sql);
      if (vacuum?.[1]) {
        await writeFile(vacuum[1], 'fake-sqlite-bytes');
        return [];
      }
      if (sql.includes('integrity_check')) {
        return [{ integrity_check: 'ok' }];
      }
      if (sql.includes('_prisma_migrations')) {
        return [{ migration_name: '20260101000000_test' }];
      }
      return [];
    }),
    // migrations lookup (currentMigration uses $queryRawUnsafe too)
    $queryRaw: vi.fn(() => Promise.resolve([{ migration_name: '20260101000000_test' }])),
    $disconnect: vi.fn(() => Promise.resolve(undefined)),
    $connect: vi.fn(() => Promise.resolve(undefined)),
  };
}

function makeService(prisma = prismaMock()): { service: BackupService; prisma: ReturnType<typeof prismaMock> } {
  const env = {
    BACKUP_DIR: backupDir,
    STORAGE_DIR: storageDir,
    DATABASE_URL: `file:${join(baseDir, 'schema-dir', 'test.db')}`,
  };
  return { service: new BackupService(prisma as never, env as never), prisma };
}

describe('R7/SEC-07 — permission hardening', () => {
  it('creates directories with mode 0700', async () => {
    const dir = join(baseDir, 'private-new');
    await ensurePrivateDir(dir);
    expect(await modeOf(dir)).toBe(0o700);
  });

  it('hardens existing trees: files 0600, dirs 0700', async () => {
    const root = join(baseDir, 'tree');
    const sub = join(root, 'ab');
    await mkdir(sub, { recursive: true });
    await writeFile(join(sub, 'file.txt'), 'x', { mode: 0o644 });
    await writeFile(join(root, 'top.txt'), 'x', { mode: 0o644 });

    await hardenTree(root);

    expect(await modeOf(root)).toBe(0o700);
    expect(await modeOf(sub)).toBe(0o700);
    expect(await modeOf(join(sub, 'file.txt'))).toBe(0o600);
    expect(await modeOf(join(root, 'top.txt'))).toBe(0o600);
  });

  it('derives the database directory from a file: URL', () => {
    const cwd = process.cwd();
    expect(databaseDirectory('file:/abs/path/mechanic.db', cwd)).toBe('/abs/path');
    expect(databaseDirectory('file:./e2e.db?connection_limit=1', cwd)).toMatch(
      /database[/\\]prisma$/,
    );
  });

  it('resolves relative DATABASE_URL against the schema dir (parity with Prisma)', () => {
    const resolved = databaseFilePath('file:./test.db', process.cwd());
    expect(resolved).toMatch(/database[/\\]prisma[/\\]test\.db$/);
    expect(databaseFilePath('file:/abs/mechanic.db', process.cwd())).toBe('/abs/mechanic.db');
  });
});

describe('BackupService (Fase 10)', () => {
  beforeEach(async () => {
    await rm(backupDir, { recursive: true, force: true });
    // Reset storage with one known file.
    await rm(storageDir, { recursive: true, force: true });
    await mkdir(join(storageDir, 'ab'), { recursive: true });
    await writeFile(join(storageDir, 'ab', 'ab1'), 'image-bytes', { mode: 0o600 });
  });

  it('creates a backup with manifest, snapshot and storage copy', async () => {
    const { service } = makeService();
    const backup = await service.create();

    expect(backup.id).toMatch(/^[0-9T-]+Z-[0-9a-f]{6}$/);
    expect(backup.manifest.schemaVersion).toBe(1);
    expect(backup.manifest.databaseSizeBytes).toBe('fake-sqlite-bytes'.length);
    expect(backup.manifest.storageFiles).toBe(1);
    expect(backup.manifest.prismaMigration).toBe('20260101000000_test');
    // 64 hex chars = sha256
    expect(backup.manifest.databaseSha256).toMatch(/^[0-9a-f]{64}$/);

    const listed = await service.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(backup.id);
  });

  it('verifies sha256 on restore and rejects a corrupted snapshot', async () => {
    const { service } = makeService();
    const backup = await service.create();

    // Corrupt the snapshot in place.
    await writeFile(join(backupDir, backup.id, 'database.db'), 'tampered');

    await expect(service.restore(backup.id)).rejects.toMatchObject({
      code: 'BACKUP_CORRUPT',
      status: 409,
    });
  });

  it('restore disconnects, swaps files and reconnects', async () => {
    const { service, prisma } = makeService();
    const backup = await service.create();
    // The service's DATABASE_URL is absolute → resolved as-is.
    const liveDb = join(baseDir, 'schema-dir', 'test.db');
    await mkdir(join(baseDir, 'schema-dir'), { recursive: true });
    await writeFile(liveDb, 'old-live-data');

    const result = await service.restore(backup.id);

    expect(result.databaseRestored).toBe(true);
    expect(prisma.$disconnect).toHaveBeenCalled();
    expect(prisma.$connect).toHaveBeenCalled();
    // The live database path now holds the snapshot content.
    const { readFile } = await import('node:fs/promises');
    expect(await readFile(liveDb, 'utf8')).toBe('fake-sqlite-bytes');
  });

  it('rejects a tampered/unknown backup id with VALIDATION_ERROR', async () => {
    const { service } = makeService();
    await expect(service.readOne('weird id!')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('404s on unknown backup id (safe chars)', async () => {
    const { service } = makeService();
    await expect(service.readOne('2099-01-01T00-00-00-000Z-abcdef')).rejects.toMatchObject({
      code: 'BACKUP_NOT_FOUND',
      status: 404,
    });
  });

  it('deletes a backup folder', async () => {
    const { service } = makeService();
    const backup = await service.create();
    await service.remove(backup.id);
    await expect(service.readOne(backup.id)).rejects.toBeInstanceOf(DomainError);
  });
});
