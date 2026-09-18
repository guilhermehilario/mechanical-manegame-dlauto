import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../src/modules/settings/settings.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { Env } from '@mechanic-system/config';
import type { ShopSettings } from '@prisma/client';

function makeRow(overrides: Partial<ShopSettings> = {}): ShopSettings {
  return {
    id: 'set_1',
    name: 'Minha Oficina',
    phone: null,
    address: null,
    documentFooter: null,
    backupAutoEnabled: null,
    backupIntervalHours: null,
    backupKeep: null,
    backupAlertAfterHours: null,
    updatedAt: new Date('2026-09-16T12:00:00Z'),
    ...overrides,
  };
}

function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    BACKUP_AUTO_ENABLED: '1',
    BACKUP_INTERVAL_HOURS: 24,
    BACKUP_KEEP: 14,
    BACKUP_ALERT_AFTER_HOURS: 24,
    ...overrides,
  } as unknown as Env;
}

function prismaMock() {
  return {
    shopSettings: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

function makeService(prisma = prismaMock(), env = testEnv()): {
  service: SettingsService;
  prisma: ReturnType<typeof prismaMock>;
} {
  return {
    service: new SettingsService(prisma as unknown as PrismaService, env),
    prisma,
  };
}

describe('SettingsService (Bloco F2 mínimo)', () => {
  it('materializes the singleton on first read', async () => {
    const { service, prisma } = makeService();
    prisma.shopSettings.findFirst.mockResolvedValue(null);
    prisma.shopSettings.create.mockResolvedValue(makeRow());

    const result = await service.get();

    expect(prisma.shopSettings.create).toHaveBeenCalledTimes(1);
    expect(result.name).toBe('Minha Oficina');
  });

  it('returns the existing row without creating', async () => {
    const { service, prisma } = makeService();
    prisma.shopSettings.findFirst.mockResolvedValue(makeRow({ name: 'Auto Center' }));

    const result = await service.get();

    expect(prisma.shopSettings.create).not.toHaveBeenCalled();
    expect(result.name).toBe('Auto Center');
  });

  it('updates the existing row and clears optional fields', async () => {
    const { service, prisma } = makeService();
    prisma.shopSettings.findFirst.mockResolvedValue(makeRow());
    prisma.shopSettings.update.mockResolvedValue(
      makeRow({ name: 'Oficina Nova', phone: '1133334444', address: null }),
    );

    const result = await service.update({
      name: 'Oficina Nova',
      phone: '1133334444',
      address: null,
      documentFooter: null,
    });

    expect(prisma.shopSettings.update).toHaveBeenCalledWith({
      where: { id: 'set_1' },
      data: { name: 'Oficina Nova', phone: '1133334444', address: null, documentFooter: null },
    });
    expect(result.phone).toBe('1133334444');
  });

  it('creates the row when updating with none present', async () => {
    const { service, prisma } = makeService();
    prisma.shopSettings.findFirst.mockResolvedValue(null);
    prisma.shopSettings.create.mockResolvedValue(makeRow({ name: 'Criada via update' }));

    const result = await service.update({
      name: 'Criada via update',
      phone: null,
      address: null,
      documentFooter: null,
    });

    expect(prisma.shopSettings.create).toHaveBeenCalledTimes(1);
    expect(result.name).toBe('Criada via update');
  });
});

describe('SettingsService backup runtime config (Bloco E/E2 — 2026-09-18)', () => {
  it('falls back to env defaults when the row has no saved config', async () => {
    const { service, prisma } = makeService();
    prisma.shopSettings.findFirst.mockResolvedValue(null);

    const config = await service.getBackupRuntimeConfig();

    expect(config).toEqual({
      autoEnabled: true,
      intervalHours: 24,
      alertAfterHours: 24,
      keep: 14,
    });
  });

  it('prefers saved row values over env defaults', async () => {
    const { service, prisma } = makeService(prismaMock(), testEnv({ BACKUP_INTERVAL_HOURS: 24 }));
    prisma.shopSettings.findFirst.mockResolvedValue(
      makeRow({ backupAutoEnabled: false, backupIntervalHours: 2, backupKeep: 5 }),
    );

    const config = await service.getBackupRuntimeConfig();

    expect(config).toEqual({
      autoEnabled: false,
      intervalHours: 2,
      alertAfterHours: 24,
      keep: 5,
    });
  });

  it('persists config updates on the existing row and returns effective values', async () => {
    const { service, prisma } = makeService();
    prisma.shopSettings.findFirst.mockResolvedValue(makeRow());
    prisma.shopSettings.update.mockResolvedValue(
      makeRow({ backupAutoEnabled: true, backupIntervalHours: 6, backupAlertAfterHours: 3, backupKeep: 7 }),
    );
    prisma.shopSettings.findFirst.mockResolvedValue(
      makeRow({ backupAutoEnabled: true, backupIntervalHours: 6, backupAlertAfterHours: 3, backupKeep: 7 }),
    );

    const result = await service.updateBackupRuntimeConfig({
      autoEnabled: true,
      intervalHours: 6,
      keep: 7,
      alertAfterHours: 3,
    });

    expect(prisma.shopSettings.update).toHaveBeenCalledWith({
      where: { id: 'set_1' },
      data: {
        backupAutoEnabled: true,
        backupIntervalHours: 6,
        backupKeep: 7,
        backupAlertAfterHours: 3,
      },
    });
    expect(result).toEqual({ autoEnabled: true, intervalHours: 6, keep: 7, alertAfterHours: 3 });
  });

  it('creates the singleton row when saving config with none present', async () => {
    const { service, prisma } = makeService();
    prisma.shopSettings.findFirst.mockResolvedValueOnce(null);
    prisma.shopSettings.create.mockResolvedValue(
      makeRow({ backupIntervalHours: 12, backupKeep: 2 }),
    );
    prisma.shopSettings.findFirst.mockResolvedValueOnce(
      makeRow({ backupIntervalHours: 12, backupKeep: 2 }),
    );

    const result = await service.updateBackupRuntimeConfig({
      autoEnabled: true,
      intervalHours: 12,
      keep: 2,
      alertAfterHours: 24,
    });

    expect(prisma.shopSettings.create).toHaveBeenCalledTimes(1);
    expect(result.intervalHours).toBe(12);
    expect(result.keep).toBe(2);
  });
});
