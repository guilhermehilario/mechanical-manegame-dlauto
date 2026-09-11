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
