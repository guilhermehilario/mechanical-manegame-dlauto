import { describe, expect, it, vi } from 'vitest';
import { CatalogSeedService } from '../src/modules/catalog-seed/catalog-seed.service';
import { SEED_PRODUCTS, SEED_SERVICES, SEED_SUPPLIERS } from '../src/modules/catalog-seed/catalog-data';

function txClient() {
  const service = { findMany: vi.fn(), create: vi.fn() };
  const supplier = { findMany: vi.fn(), create: vi.fn() };
  const product = { findMany: vi.fn(), create: vi.fn() };
  return { service, supplier, product };
}

function prismaMock() {
  const tx = txClient();
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  return { prisma, tx };
}

function makeService(prisma: ReturnType<typeof prismaMock>['prisma']) {
  return new CatalogSeedService(prisma as never);
}

describe('CatalogSeedService.seed (F3)', () => {
  it('seeds the full example catalog when the database is empty', async () => {
    const prisma = prismaMock();
    prisma.tx.service.findMany.mockResolvedValue([]);
    prisma.tx.supplier.findMany.mockResolvedValue([]);
    prisma.tx.product.findMany.mockResolvedValue([]);

    const result = await makeService(prisma.prisma).seed();

    expect(result).toEqual({
      services: SEED_SERVICES.length,
      products: SEED_PRODUCTS.length,
      suppliers: SEED_SUPPLIERS.length,
    });
    expect(prisma.tx.service.create).toHaveBeenCalledTimes(SEED_SERVICES.length);
    expect(prisma.tx.product.create).toHaveBeenCalledTimes(SEED_PRODUCTS.length);
    expect(prisma.tx.supplier.create).toHaveBeenCalledTimes(SEED_SUPPLIERS.length);
    // Runs in a single transaction.
    expect(prisma.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('skips items that already exist (idempotent)', async () => {
    const prisma = prismaMock();
    prisma.tx.service.findMany.mockResolvedValue(SEED_SERVICES.map((s) => ({ name: s.name })));
    prisma.tx.supplier.findMany.mockResolvedValue(SEED_SUPPLIERS.map((s) => ({ cnpj: s.cnpj })));
    prisma.tx.product.findMany.mockResolvedValue(SEED_PRODUCTS.map((p) => ({ code: p.code })));

    const result = await makeService(prisma.prisma).seed();

    expect(result).toEqual({ services: 0, products: 0, suppliers: 0 });
    expect(prisma.tx.service.create).not.toHaveBeenCalled();
    expect(prisma.tx.supplier.create).not.toHaveBeenCalled();
    expect(prisma.tx.product.create).not.toHaveBeenCalled();
  });

  it('seeds only what is missing', async () => {
    const prisma = prismaMock();
    prisma.tx.service.findMany.mockResolvedValue([]);
    prisma.tx.supplier.findMany.mockResolvedValue([]);
    // Half the products already exist.
    prisma.tx.product.findMany.mockResolvedValue(
      SEED_PRODUCTS.slice(0, 5).map((p) => ({ code: p.code })),
    );

    const result = await makeService(prisma.prisma).seed();

    expect(result.services).toBe(SEED_SERVICES.length);
    expect(result.suppliers).toBe(SEED_SUPPLIERS.length);
    expect(result.products).toBe(SEED_PRODUCTS.length - 5);
  });
});