import type {
  BackupConfigDto,
  BackupDto,
  CreateBackupResultDto,
  RestoreResultDto,
} from '@mechanic-system/types';
import { api } from './auth.service';

/**
 * Backup/restore endpoints (Fase 10, spec §3) — admin-only surface.
 */
export function listBackups(): Promise<BackupDto[]> {
  return api.get('/backups');
}

export function createBackup(): Promise<CreateBackupResultDto> {
  return api.post('/backups', {});
}

export function restoreBackup(id: string): Promise<RestoreResultDto> {
  // confirm: true is REQUIRED by the API (destructive guardrail).
  return api.post(`/backups/${id}/restore`, { confirm: true });
}

export function deleteBackup(id: string): Promise<void> {
  return api.delete(`/backups/${id}`);
}

// ─── Runtime backup configuration (settings screen, 2026-09-18) ─────────────

export function getBackupConfig(): Promise<BackupConfigDto> {
  return api.get<BackupConfigDto>('/backups/config');
}

export function updateBackupConfig(input: BackupConfigDto): Promise<BackupConfigDto> {
  return api.put<BackupConfigDto>('/backups/config', input);
}
