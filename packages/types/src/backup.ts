/**
 * Backup/restore DTOs (Fase 10, spec §3).
 * A backup is a consistent, self-contained folder: SQLite snapshot via
 * `VACUUM INTO` (WAL-safe) + a full copy of the image storage dir, wrapped
 * by a manifest for verification before restore.
 */

export interface BackupManifest {
  /** Schema/version marker — a restore refuses mismatches. */
  schemaVersion: number;
  createdAt: string; // ISO-8601
  /** sha256 of the database snapshot file. */
  databaseSha256: number extends never ? never : string;
  databaseSizeBytes: number;
  /** Number of files (and total bytes) captured from STORAGE_DIR. */
  storageFiles: number;
  storageBytes: number;
  /** Prisma migration applied when the backup was taken. */
  prismaMigration: string | null;
}

export interface BackupDto {
  id: string; // folder name, e.g. 2026-09-11T12-00-00-000Z-a1b2c3
  createdAt: string;
  sizeBytes: number;
  databaseSizeBytes: number;
  storageFiles: number;
  manifest: BackupManifest;
}

export interface CreateBackupResultDto {
  backup: BackupDto;
}

export interface RestoreResultDto {
  restoredAt: string;
  /** `database` or `storage` files restored count, for the audit log. */
  databaseRestored: boolean;
  storageRestored: boolean;
}
