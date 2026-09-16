import type { ShopSettingsDto } from '@mechanic-system/types';
import type { ShopSettingsInput } from '@mechanic-system/validation';
import { api } from './auth.service';

/**
 * Shop settings (Bloco F2 mínimo) — identity used by printed documents.
 * Read is open to every role; the API enforces ADMIN/MANAGER on write.
 */
export function getShopSettings(): Promise<ShopSettingsDto> {
  return api.get<ShopSettingsDto>('/settings');
}

export function updateShopSettings(input: ShopSettingsInput): Promise<ShopSettingsDto> {
  return api.put<ShopSettingsDto>('/settings', input);
}
