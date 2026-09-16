import { z } from 'zod';

/**
 * Shop settings (Bloco F2 mínimo). Optional fields collapse to null when the
 * shop does not want them on the printed documents.
 */
export const shopSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(32).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  documentFooter: z.string().trim().max(255).optional().nullable(),
});
export type ShopSettingsInput = z.infer<typeof shopSettingsSchema>;
