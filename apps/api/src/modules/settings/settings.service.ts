import { Injectable } from '@nestjs/common';
import type { ShopSettings } from '@prisma/client';
import type { Env } from '@mechanic-system/config';
import type { BackupConfigDto, ShopSettingsDto } from '@mechanic-system/types';
import type { ShopSettingsInput } from '@mechanic-system/validation';
import type { BackupConfigInput } from '../../common/backup/backup-validation';
import { PrismaService } from '../../prisma/prisma.service';

function toDto(settings: ShopSettings): ShopSettingsDto {
  return {
    name: settings.name,
    phone: settings.phone,
    address: settings.address,
    documentFooter: settings.documentFooter,
    dateFormat: settings.dateFormat === 'YYYY_MM_DD' || settings.dateFormat === 'MM_DD_YYYY'
      ? settings.dateFormat
      : 'DD_MM_YYYY',
    // Legacy rows predate the column (NULL): normalize to the default.
    timeFormat: settings.timeFormat === 'H12' ? 'H12' : 'H24',
    updatedAt: settings.updatedAt.toISOString(),
  };
}

/**
 * Shop settings (Bloco F2 mínimo) + runtime backup configuration (Bloco
 * E/E2, 2026-09-18) — singleton row. The first read materializes the row
 * with a neutral placeholder name (the shop edits it in the UI).
 *
 * Backup config is stored as nullable columns: NULL means "keep the packaged
 * env default" (BACKUP_*), so a fresh install behaves exactly as before and
 * only an explicit save in the settings screen overrides it.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: Env,
  ) {}

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
      dateFormat: input.dateFormat,
      timeFormat: input.timeFormat,
    };
    if (current) {
      return toDto(await this.prisma.shopSettings.update({ where: { id: current.id }, data }));
    }
    return toDto(await this.prisma.shopSettings.create({ data }));
  }

  /** Effective backup config = saved row values over env defaults. */
  async getBackupRuntimeConfig(): Promise<BackupConfigDto> {
    const row = await this.prisma.shopSettings.findFirst();
    return {
      autoEnabled: row?.backupAutoEnabled ?? this.env.BACKUP_AUTO_ENABLED === '1',
      intervalHours: row?.backupIntervalHours ?? this.env.BACKUP_INTERVAL_HOURS,
      keep: row?.backupKeep ?? this.env.BACKUP_KEEP,
      alertAfterHours: row?.backupAlertAfterHours ?? this.env.BACKUP_ALERT_AFTER_HOURS,
    };
  }

  async updateBackupRuntimeConfig(input: BackupConfigInput): Promise<BackupConfigDto> {
    const data = {
      backupAutoEnabled: input.autoEnabled,
      backupIntervalHours: input.intervalHours,
      backupKeep: input.keep,
      backupAlertAfterHours: input.alertAfterHours,
    };
    const current = await this.prisma.shopSettings.findFirst();
    if (current) {
      await this.prisma.shopSettings.update({ where: { id: current.id }, data });
    } else {
      await this.prisma.shopSettings.create({ data: { name: 'Minha Oficina', ...data } });
    }
    return this.getBackupRuntimeConfig();
  }
}