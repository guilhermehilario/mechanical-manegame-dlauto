import { z } from 'zod';

/**
 * Display preferences — date and time formats used across the UI.
 * DD_MM_YYYY = padrão brasileiro; a data sempre em dd/mm, aaaa/mm/dd ou
 * mm/dd aaaa; H24 = HH:mm, H12 = hh:mm AM/PM.
 */
export const DATE_FORMATS = ['DD_MM_YYYY', 'YYYY_MM_DD', 'MM_DD_YYYY'] as const;
export const dateFormatSchema = z.enum(DATE_FORMATS);
export type DateFormat = z.infer<typeof dateFormatSchema>;

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
  dateFormat: dateFormatSchema.default('DD_MM_YYYY'),
  timeFormat: timeFormatSchema.default('H24'),
});
export type ShopSettingsInput = z.infer<typeof shopSettingsSchema>;
