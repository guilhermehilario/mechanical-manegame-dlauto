import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Logger } from '@nestjs/common/services/logger.service';
import type { Env } from '@mechanic-system/config';
import type { BackupStatusDto } from '@mechanic-system/types';
import { BackupService } from './backup.service';

/**
 * BackupSchedulerService (Bloco E, tasks E1+E2 of docs/todo-mvp.md).
 *
 * The whole business dataset is local-only (SQLite + image files), so the
 * automatic backup is the real safety net — Fase 10 shipped only the manual
 * UI. The scheduler:
 *
 *  - runs a sweep on boot and then on a fixed interval (BACKUP_INTERVAL_HOURS);
 *  - creates a backup only when the newest one is older than the interval
 *    (restarts do NOT spam new backups);
 *  - applies retention: keeps the newest BACKUP_KEEP backups and permanently
 *    deletes older ones (including stale ones from previous runs);
 *  - never crashes the API: every failure is logged and swallowed — a failed
 *    backup must not take the workshop's system down.
 *
 * The dashboard reads `getStatus()` (via GET /backups/status) and shows the
 * stale-backup warning banner.
 */

/** One-shot interval handle so the app can stop it cleanly on shutdown. */
let intervalHandle: ReturnType<typeof setInterval> | null = null;

@Injectable()
export class BackupSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private readonly enabled: boolean;
  private readonly intervalHours: number;
  private readonly alertAfterHours: number;
  private readonly keep: number;
  private running = false;

  constructor(
    private readonly backups: BackupService,
    env: Env,
  ) {
    this.enabled = env.BACKUP_AUTO_ENABLED === '1';
    this.intervalHours = env.BACKUP_INTERVAL_HOURS;
    this.alertAfterHours = env.BACKUP_ALERT_AFTER_HOURS;
    this.keep = env.BACKUP_KEEP;
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Backup automático desativado (BACKUP_AUTO_ENABLED=0)');
      return;
    }
    // Fire-and-forget: boot must never wait on disk I/O.
    void this.sweep().catch((error: unknown) => {
      this.logger.warn(
        `Sweep inicial de backup falhou: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    const ms = this.intervalHours * 3_600_000;
    intervalHandle = setInterval(() => {
      void this.sweep().catch((error: unknown) => {
        this.logger.warn(
          `Sweep de backup falhou: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, ms);
    // Do not hold the event loop open just for backups.
    intervalHandle.unref();
    this.logger.log(
      `Backup automático ativo — intervalo ${this.intervalHours}h, retenção ${this.keep}, alerta após ${this.alertAfterHours}h`,
    );
  }

  onModuleDestroy(): void {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  /**
   * One scheduler tick: create-if-due + retention. Serialized (`running`
   * flag) so overlapping ticks never double-create; errors propagate to the
   * caller (which logs and swallows).
   */
  async sweep(): Promise<{ created: boolean; backupId: string | null; pruned: number }> {
    if (this.running) {
      return { created: false, backupId: null, pruned: 0 };
    }
    this.running = true;
    try {
      const status = await this.getStatus();
      const due =
        status.latestAt === null ||
        (status.hoursSinceLast ?? Infinity) >= this.intervalHours;

      let backupId: string | null = null;
      if (due) {
        const backup = await this.backups.create();
        backupId = backup.id;
        this.logger.log(`Backup automático criado: ${backup.id}`);
      }

      const pruned = await this.applyRetention();
      return { created: backupId !== null, backupId, pruned };
    } finally {
      this.running = false;
    }
  }

  /**
   * Retention (E1): keep only the newest `keep` backups. Also removes
   * half-written/legacy junk naturally — anything beyond the cap.
   */
  async applyRetention(): Promise<number> {
    const all = await this.backups.list(); // newest first
    if (all.length <= this.keep) return 0;
    const stale = all.slice(this.keep);
    for (const backup of stale) {
      await this.backups.remove(backup.id).catch(() => undefined);
    }
    if (stale.length > 0) {
      this.logger.log(`Retenção de backup: ${stale.length} backup(s) antigo(s) removido(s)`);
    }
    return stale.length;
  }

  /**
   * Dashboard/banner source of truth (E2). Derived from the newest backup —
   * never stored. Manual backups count too (any fresh backup is a fresh
   * safety net).
   */
  async getStatus(): Promise<BackupStatusDto> {
    const all = await this.backups.list();
    const latest = all[0] ?? null;
    const latestAt = latest?.createdAt ?? null;
    const hoursSinceLast = latestAt
      ? (Date.now() - new Date(latestAt).getTime()) / 3_600_000
      : null;
    const isStale = hoursSinceLast === null || hoursSinceLast > this.alertAfterHours;
    return {
      latest,
      latestAt,
      hoursSinceLast,
      alertAfterHours: this.alertAfterHours,
      isStale,
      autoEnabled: this.enabled,
    };
  }
}
