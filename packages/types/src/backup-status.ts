import type { BackupDto } from './backup';

/**
 * Health of the automatic backup routine (Bloco E — task E1/E2 of
 * docs/todo-mvp.md). Derived, never stored: the scheduler derives it from
 * the newest backup folder inside BACKUP_DIR.
 */
export interface BackupStatusDto {
  /** Newest backup, when one exists. */
  latest: BackupDto | null;
  /** ISO-8601 of the newest backup, null when there is none. */
  latestAt: string | null;
  /** Hours elapsed since the newest backup (null when there is none). */
  hoursSinceLast: number | null;
  /** Alert threshold — also surfaced so the UI can explain the banner. */
  alertAfterHours: number;
  /** True when hoursSinceLast is null or > alertAfterHours. */
  isStale: boolean;
  /** True when the scheduler is enabled via env (BACKUP_AUTO_ENABLED). */
  autoEnabled: boolean;
}
