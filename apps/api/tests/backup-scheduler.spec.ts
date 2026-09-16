import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BackupSchedulerService } from '../src/common/backup/backup-scheduler.service';
import type { BackupService } from '../src/common/backup/backup.service';
import type { Env } from '@mechanic-system/config';

/**
 * Bloco E (docs/todo-mvp.md) — automatic backup scheduler:
 *  - sweeps on boot + interval; creates a backup only when the newest one is
 *    older than the interval (restarts don't spam backups);
 *  - retention keeps the newest N;
 *  - getStatus() drives the dashboard stale-backup banner.
 * BackupService is mocked (its filesystem behavior is covered by backup.spec).
 */

function makeBackupDto(createdAt: Date, id = 'bk-1') {
  return {
    id,
    createdAt: createdAt.toISOString(),
    sizeBytes: 10,
    databaseSizeBytes: 6,
    storageFiles: 0,
    manifest: {
      schemaVersion: 1,
      createdAt: createdAt.toISOString(),
      databaseSha256: 'a'.repeat(64),
      databaseSizeBytes: 6,
      storageFiles: 0,
      storageBytes: 4,
      prismaMigration: null,
    },
  };
}

function backupServiceMock() {
  return {
    create: vi.fn(() => Promise.resolve(makeBackupDto(new Date(), `bk-${Math.random()}`))),
    list: vi.fn(() => Promise.resolve([] as ReturnType<typeof makeBackupDto>[])),
    remove: vi.fn(() => Promise.resolve(undefined)),
  };
}

function makeScheduler(
  backupService: ReturnType<typeof backupServiceMock>,
  overrides: Partial<Env> = {},
): BackupSchedulerService {
  const env = {
    BACKUP_AUTO_ENABLED: '1',
    BACKUP_INTERVAL_HOURS: 24,
    BACKUP_ALERT_AFTER_HOURS: 24,
    BACKUP_KEEP: 3,
    ...overrides,
  } as unknown as Env;
  return new BackupSchedulerService(backupService as unknown as BackupService, env);
}

let baseDir: string;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), 'mechanic-backup-sched-'));
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('BackupSchedulerService', () => {
  it('creates a backup when none exists (first sweep)', async () => {
    const backupService = backupServiceMock();
    const scheduler = makeScheduler(backupService);

    const result = await scheduler.sweep();

    expect(result.created).toBe(true);
    expect(backupService.create).toHaveBeenCalledTimes(1);
  });

  it('does NOT create a backup when the newest one is fresh', async () => {
    const backupService = backupServiceMock();
    backupService.list.mockResolvedValue([makeBackupDto(new Date(Date.now() - 3_600_000))]); // 1h ago
    const scheduler = makeScheduler(backupService);

    const result = await scheduler.sweep();

    expect(result.created).toBe(false);
    expect(backupService.create).not.toHaveBeenCalled();
  });

  it('creates a backup when the newest one is older than the interval', async () => {
    const backupService = backupServiceMock();
    backupService.list.mockResolvedValue([
      makeBackupDto(new Date(Date.now() - 25 * 3_600_000)), // 25h ago
    ]);
    const scheduler = makeScheduler(backupService, { BACKUP_INTERVAL_HOURS: 24 });

    const result = await scheduler.sweep();

    expect(result.created).toBe(true);
  });

  it('applies retention: keeps the newest N and deletes the rest', async () => {
    const backupService = backupServiceMock();
    const hoursAgo = (h: number): Date => new Date(Date.now() - h * 3_600_000);
    backupService.list.mockResolvedValue([
      makeBackupDto(hoursAgo(1), 'bk-new-1'),
      makeBackupDto(hoursAgo(2), 'bk-new-2'),
      makeBackupDto(hoursAgo(3), 'bk-new-3'),
      makeBackupDto(hoursAgo(30), 'bk-old-4'),
      makeBackupDto(hoursAgo(50), 'bk-old-5'),
    ]);
    const scheduler = makeScheduler(backupService, { BACKUP_KEEP: 3 });

    const result = await scheduler.sweep();

    expect(result.pruned).toBe(2);
    expect(backupService.remove).toHaveBeenCalledTimes(2);
    expect(backupService.remove).toHaveBeenCalledWith('bk-old-4');
    expect(backupService.remove).toHaveBeenCalledWith('bk-old-5');
  });

  it('reports stale status when there is no backup', async () => {
    const backupService = backupServiceMock();
    const scheduler = makeScheduler(backupService);

    const status = await scheduler.getStatus();

    expect(status.isStale).toBe(true);
    expect(status.latest).toBeNull();
    expect(status.hoursSinceLast).toBeNull();
    expect(status.autoEnabled).toBe(true);
  });

  it('reports stale status past the alert threshold', async () => {
    const backupService = backupServiceMock();
    backupService.list.mockResolvedValue([
      makeBackupDto(new Date(Date.now() - 30 * 3_600_000)),
    ]);
    const scheduler = makeScheduler(backupService, { BACKUP_ALERT_AFTER_HOURS: 24 });

    const status = await scheduler.getStatus();

    expect(status.isStale).toBe(true);
    expect(status.hoursSinceLast).toBeGreaterThan(24);
  });

  it('reports fresh status inside the alert threshold', async () => {
    const backupService = backupServiceMock();
    backupService.list.mockResolvedValue([
      makeBackupDto(new Date(Date.now() - 2 * 3_600_000)),
    ]);
    const scheduler = makeScheduler(backupService, { BACKUP_ALERT_AFTER_HOURS: 24 });

    const status = await scheduler.getStatus();

    expect(status.isStale).toBe(false);
  });

  it('is disabled via BACKUP_AUTO_ENABLED=0 (no timer, no sweep on init)', async () => {
    const backupService = backupServiceMock();
    const scheduler = makeScheduler(backupService, { BACKUP_AUTO_ENABLED: '0' });

    // onModuleInit must not schedule anything; sweep stays manual/test-only.
    scheduler.onModuleInit();
    const status = await scheduler.getStatus();
    expect(status.autoEnabled).toBe(false);

    // Interval never scheduled → sweep would still work if called directly,
    // but the flag reflects the env contract for the UI.
  });

  it('onModuleDestroy clears the interval without throwing when idle', () => {
    const scheduler = makeScheduler(backupServiceMock());
    expect(() => {
      scheduler.onModuleDestroy();
    }).not.toThrow();
  });
});
