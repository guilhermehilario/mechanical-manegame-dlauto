import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../src/modules/settings/settings.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { ShopSettings } from '@prisma/client';

function makeRow(overrides: Partial<ShopSettings> = {}): ShopSettings {
  return {
    id: 'set_1',
    name: 'Minha Oficina',
    phone: null,
    address: null,
    documentFooter: null,
    updatedAt: new Date('2026-09-16T12:00:00Z'),
    ...overrides,
  };
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

function makeService(prisma = prismaMock()): {
  service: SettingsService;
  prisma: ReturnType<typeof prismaMock>;
} {
  return { service: new SettingsService(prisma as unknown as PrismaService), prisma };
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
