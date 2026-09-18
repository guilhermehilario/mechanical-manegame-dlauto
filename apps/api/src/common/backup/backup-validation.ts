import { z } from 'zod';

/**
 * Backup/restore input schemas (Fase 10). Restore is destructive, so it
 * requires an explicit `confirm: true` in the body — no accidental clicks.
 */

export const backupIdParamSchema = z
  .string()
  .trim()
  .min(10)
  .max(80)
  .regex(/^[A-Za-z0-9.-]+$/, 'Identificador de backup inválido');

export const restoreBackupSchema = z
  .object({
    confirm: z.literal(true, {
      message: 'A restauração substitui TODOS os dados atuais — envie confirm: true.',
    }),
  })
  .strict();

export type RestoreBackupInput = z.infer<typeof restoreBackupSchema>;

/**
 * Runtime backup configuration (settings screen, Bloco E/E2 — 2026-09-18).
 * Bounded the same way as the env defaults (packages/config) so the UI
 * cannot set absurd values.
 */
export const backupConfigSchema = z
  .object({
    autoEnabled: z.boolean(),
    intervalHours: z.coerce.number().int().min(1).max(168),
    keep: z.coerce.number().int().min(1).max(365),
    alertAfterHours: z.coerce.number().int().min(1).max(720),
  })
  .strict();

export type BackupConfigInput = z.infer<typeof backupConfigSchema>;
