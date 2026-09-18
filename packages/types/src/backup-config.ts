/**
 * Runtime backup configuration (settings screen, Bloco E/E2 — 2026-09-18).
 * Effective values: stored in the shop_settings row when the operator
 * customized them, otherwise the packaged env defaults (BACKUP_*).
 */
export interface BackupConfigDto {
  /** Whether the automatic backup scheduler is active. */
  autoEnabled: boolean;
  /** How often the scheduler tries to create a backup, in hours. */
  intervalHours: number;
  /** How many automatic backups to keep (oldest beyond this are deleted). */
  keep: number;
  /** Hours without a new backup before the dashboard warns. */
  alertAfterHours: number;
}
