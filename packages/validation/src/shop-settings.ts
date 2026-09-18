import { z } from 'zod';

/**
 * Display preferences — time format used across the UI.
 * H24 = dd/mm/aaaa HH:mm (24h, padrão brasileiro); H12 = dd/mm/aaaa hh:mm AM/PM.
 */
export const TIME_FORMATS = ['H24', 'H12'] as const;
export const timeFormatSchema = z.enum(TIME_FORMATS);
export type TimeFormat = z.infer<typeof timeFormatSchema>;

/**
 * Shop settings (Bloco F2 mínimo). Optional fields collapse to null when the
 * shop does not want them on the printed documents.
 */
export const shopSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(32).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  documentFooter: z.string().trim().max(255).optional().nullable(),
  timeFormat: timeFormatSchema.default('H24'),
});
export type ShopSettingsInput = z.infer<typeof shopSettingsSchema>;
