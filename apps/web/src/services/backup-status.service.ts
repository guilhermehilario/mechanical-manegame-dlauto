import type { BackupStatusDto } from '@mechanic-system/types';
import { api } from './auth.service';

/**
 * Backup health (Bloco E/E2) — admin/manager only (API enforces it, same as
 * the dashboard data itself).
 */
export function getBackupStatus(): Promise<BackupStatusDto> {
  return api.get<BackupStatusDto>('/backups/status');
}
