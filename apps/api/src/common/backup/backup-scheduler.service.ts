import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Logger } from '@nestjs/common/services/logger.service';
import type { BackupStatusDto } from '@mechanic-system/types';
import type { BackupConfigDto } from '@mechanic-system/types';
import type { BackupConfigInput } from './backup-validation';
import { SettingsService } from '../../modules/settings/settings.service';
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
 * **2026-09-18:** runtime configuration stored in `shop_settings` with env
 * fallback (SettingsService). The operator can change interval/keep/alert on
 * the settings screen without restarting; the scheduler reschedules itself
 * after each sweep and after an explicit PUT /backups/config.
 */

@Injectable()
export class BackupSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly backups: BackupService,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    // Fire-and-forget: boot must never wait on disk I/O.
    void this.sweep().catch((error: unknown) => {
      this.logger.warn(
        `Sweep inicial de backup falhou: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    void this.initScheduleFromConfig();
  }

  onModuleDestroy(): void {
    this.clearTimer();
  }

  // ─── Config surface ───────────────────────────────────────────────────────

  async getConfig(): Promise<BackupConfigDto> {
    return this.settings.getBackupRuntimeConfig();
  }

  /**
   * Called by the controller after the operator saves new values. Reschedules
   * the timer immediately so the change takes effect before the next tick.
   * The config is persisted in SettingsService (shop_settings row).
   */
  async reschedule(): Promise<void> {
    const config = await this.settings.getBackupRuntimeConfig();
    if (!config.autoEnabled) {
      this.logger.log('Backup automático desativado — timer parado');
      this.clearTimer();
      return;
    }
    this.schedule(config.intervalHours);
  }

  /** Persist a new runtime config and apply it to the timer right away. */
  async updateAndReschedule(input: BackupConfigInput): Promise<void> {
    await this.settings.updateBackupRuntimeConfig(input);
    await this.reschedule();
  }

  // ─── Core sweep ───────────────────────────────────────────────────────────

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
      const config = await this.settings.getBackupRuntimeConfig();
      if (!config.autoEnabled) return { created: false, backupId: null, pruned: 0 };

      const status = await this.getStatus();
      const due =
        status.latestAt === null ||
        (status.hoursSinceLast ?? Infinity) >= config.intervalHours;

      let backupId: string | null = null;
      if (due) {
        const backup = await this.backups.create();
        backupId = backup.id;
        this.logger.log(`Backup automático criado: ${backup.id}`);
      }

      const pruned = await this.applyRetention(config.keep);
      // Re-sync the timer when the operator changed the interval at runtime.
      this.schedule(config.intervalHours);
      return { created: backupId !== null, backupId, pruned };
    } finally {
      this.running = false;
    }
  }

  // ─── Retention ────────────────────────────────────────────────────────────

  /**
   * Retention (E1): keep only the newest `keep` backups. Also removes
   * half-written/legacy junk naturally — anything beyond the cap.
   */
  async applyRetention(keepOverride?: number): Promise<number> {
    const keep = keepOverride ?? (await this.settings.getBackupRuntimeConfig()).keep;
    const all = await this.backups.list(); // newest first
    if (all.length <= keep) return 0;
    const stale = all.slice(keep);
    for (const backup of stale) {
      await this.backups.remove(backup.id).catch(() => undefined);
    }
    if (stale.length > 0) {
      this.logger.log(`Retenção de backup: ${stale.length} backup(s) antigo(s) removido(s)`);
    }
    return stale.length;
  }

  // ─── Status (dashboard banner) ────────────────────────────────────────────

  /**
   * Dashboard/banner source of truth (E2). Derived from the newest backup —
   * never stored. Manual backups count too (any fresh backup is a fresh
   * safety net).
   */
  async getStatus(): Promise<BackupStatusDto> {
    const config = await this.settings.getBackupRuntimeConfig();
    const all = await this.backups.list();
    const latest = all[0] ?? null;
    const latestAt = latest?.createdAt ?? null;
    const hoursSinceLast = latestAt
      ? (Date.now() - new Date(latestAt).getTime()) / 3_600_000
      : null;
    const isStale = hoursSinceLast === null || hoursSinceLast > config.alertAfterHours;
    return {
      latest,
      latestAt,
      hoursSinceLast,
      alertAfterHours: config.alertAfterHours,
      isStale,
      autoEnabled: config.autoEnabled,
    };
  }

  // ─── Timer management ─────────────────────────────────────────────────────

  private async initScheduleFromConfig(): Promise<void> {
    const config = await this.settings.getBackupRuntimeConfig();
    if (!config.autoEnabled) {
      this.logger.log('Backup automático desativado via configuração');
      return;
    }
    this.schedule(config.intervalHours);
  }

  private schedule(intervalHours: number): void {
    this.clearTimer();
    const ms = intervalHours * 3_600_000;
    this.intervalHandle = setInterval(() => {
      void this.sweep().catch((error: unknown) => {
        this.logger.warn(
          `Sweep de backup falhou: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, ms);
    this.intervalHandle.unref();
    this.logger.log(
      `Backup automático ativo — intervalo ${intervalHours}h, reconfigurável via tela de configurações`,
    );
  }

  private clearTimer(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }
}