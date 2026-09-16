import { Injectable } from '@nestjs/common';
import type { ShopSettings } from '@prisma/client';
import type { ShopSettingsDto } from '@mechanic-system/types';
import type { ShopSettingsInput } from '@mechanic-system/validation';
import { PrismaService } from '../../prisma/prisma.service';

function toDto(settings: ShopSettings): ShopSettingsDto {
  return {
    name: settings.name,
    phone: settings.phone,
    address: settings.address,
    documentFooter: settings.documentFooter,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

/**
 * Shop settings (Bloco F2 mínimo) — singleton row. The first read materializes
 * the row with a neutral placeholder name (the shop edits it in the UI).
 * Used by the printed documents; keep the surface tiny.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<ShopSettingsDto> {
    const existing = await this.prisma.shopSettings.findFirst();
    if (existing) return toDto(existing);
    const created = await this.prisma.shopSettings.create({
      data: { name: 'Minha Oficina' },
    });
    return toDto(created);
  }

  async update(input: ShopSettingsInput): Promise<ShopSettingsDto> {
    const current = await this.prisma.shopSettings.findFirst();
    const data = {
      name: input.name,
      phone: input.phone ?? null,
      address: input.address ?? null,
      documentFooter: input.documentFooter ?? null,
    };
    if (current) {
      return toDto(await this.prisma.shopSettings.update({ where: { id: current.id }, data }));
    }
    return toDto(await this.prisma.shopSettings.create({ data }));
  }
}
