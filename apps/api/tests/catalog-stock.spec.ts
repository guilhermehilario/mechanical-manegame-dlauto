import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, Service, StockMovement, Supplier } from '@prisma/client';
import { ServicesService } from '../src/modules/services/services.service';
import type { ServicesRepository } from '../src/modules/services/services.repository';
import { SuppliersService } from '../src/modules/suppliers/suppliers.service';
import type { SuppliersRepository } from '../src/modules/suppliers/suppliers.repository';
import { ProductsService } from '../src/modules/products/products.service';
import type { ProductsRepository } from '../src/modules/products/products.repository';
import { StockService } from '../src/modules/products/stock.service';
import type { PrismaService } from '../src/prisma/prisma.service';

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'svc_1',
    name: 'Troca de óleo',
    description: 'Inclui filtro',
    priceCents: 15000,
    estimatedMinutes: 40,
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: 'sup_1',
    name: 'Autopeças LTDA',
    cnpj: '45723174000110',
    phone: '1133334444',
    email: 'contato@autopecas.com',
    address: null,
    notes: null,
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prd_1',
    code: 'FIL-001',
    name: 'Filtro de óleo',
    description: null,
    costPriceCents: 2000,
    salePriceCents: 3500,
    stockQuantity: 10,
    minStock: 2,
    location: 'Prateleira A1',
    supplierId: null,
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 'mov_1',
    productId: 'prd_1',
    type: 'IN',
    quantity: 5,
    reason: 'Compra NF 123',
    previousStock: 10,
    newStock: 15,
    userId: 'usr_1',
    createdAt: new Date(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// ServicesService (catalog)
// ─────────────────────────────────────────────────────────────

describe('ServicesService', () => {
  let repo: {
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let service: ServicesService;

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
      list: vi.fn((): Promise<Service[]> => Promise.resolve([])),
      count: vi.fn((): Promise<number> => Promise.resolve(0)),
      create: vi.fn((data: Record<string, unknown>) => makeService(data as Partial<Service>)),
      update: vi.fn((id: string, data: Record<string, unknown>) => makeService({ id, ...data })),
      softDelete: vi.fn((id: string) => makeService({ id, deletedAt: new Date(), active: false })),
    };
    service = new ServicesService(repo as unknown as ServicesRepository);
  });

  it('creates a catalog service with cents price', async () => {
    const created = await service.create({
      name: 'Troca de óleo',
      description: 'Inclui filtro',
      priceCents: 15000,
      estimatedMinutes: 40,
    });
    expect(created.priceCents).toBe(15000);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Troca de óleo', priceCents: 15000 }),
    );
  });

  it('returns 404 for missing service', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toMatchObject({
      code: 'SERVICE_NOT_FOUND',
      status: 404,
    });
  });

  it('soft delete hides the service', async () => {
    repo.findById.mockResolvedValue(makeService());
    await service.softDelete('svc_1');
    expect(repo.softDelete).toHaveBeenCalledWith('svc_1');
  });
});

// ─────────────────────────────────────────────────────────────
// SuppliersService
// ─────────────────────────────────────────────────────────────

describe('SuppliersService', () => {
  let repo: {
    findById: ReturnType<typeof vi.fn>;
    findByCnpj: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let service: SuppliersService;

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
      findByCnpj: vi.fn(),
      list: vi.fn((): Promise<Supplier[]> => Promise.resolve([])),
      count: vi.fn((): Promise<number> => Promise.resolve(0)),
      create: vi.fn((data: Record<string, unknown>) => makeSupplier(data as Partial<Supplier>)),
      update: vi.fn((id: string, data: Record<string, unknown>) => makeSupplier({ id, ...data })),
      softDelete: vi.fn((id: string) => makeSupplier({ id, deletedAt: new Date(), active: false })),
    };
    service = new SuppliersService(repo as unknown as SuppliersRepository);
  });

  it('creates a supplier', async () => {
    repo.findByCnpj.mockResolvedValue(null);
    const created = await service.create({
      name: 'Autopeças LTDA',
      cnpj: '45.723.174/0001-10',
      phone: '(11) 3333-4444',
    });
    expect(created.name).toBe('Autopeças LTDA');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ cnpj: '45.723.174/0001-10' }),
    );
  });

  it('rejects duplicate CNPJ', async () => {
    repo.findByCnpj.mockResolvedValue(makeSupplier());
    await expect(
      service.create({ name: 'Outro', cnpj: '45723174000110', phone: '1133334444' }),
    ).rejects.toMatchObject({ code: 'CNPJ_ALREADY_EXISTS', status: 409 });
  });

  it('does not flag own CNPJ as duplicate on update', async () => {
    repo.findById.mockResolvedValue(makeSupplier());
    repo.findByCnpj.mockResolvedValue(makeSupplier({ id: 'sup_1' }));
    const updated = await service.update('sup_1', { phone: '1155556666' });
    expect(updated.phone).toBe('1155556666');
  });
});

// ─────────────────────────────────────────────────────────────
// ProductsService
// ─────────────────────────────────────────────────────────────

describe('ProductsService', () => {
  let repo: {
    findById: ReturnType<typeof vi.fn>;
    findByCode: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let suppliersRepo: { findById: ReturnType<typeof vi.fn> };
  let service: ProductsService;

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
      findByCode: vi.fn(),
      list: vi.fn((): Promise<Product[]> => Promise.resolve([])),
      count: vi.fn((): Promise<number> => Promise.resolve(0)),
      create: vi.fn((data: Record<string, unknown>) => makeProduct(data as Partial<Product>)),
      update: vi.fn((id: string, data: Record<string, unknown>) => makeProduct({ id, ...data })),
      softDelete: vi.fn((id: string) => makeProduct({ id, deletedAt: new Date(), active: false })),
    };
    suppliersRepo = { findById: vi.fn() };
    service = new ProductsService(
      repo as unknown as ProductsRepository,
      suppliersRepo as never,
    );
  });

  it('creates a product', async () => {
    repo.findByCode.mockResolvedValue(null);
    const created = await service.create({
      code: 'fil-001',
      name: 'Filtro de óleo',
      description: '',
      costPriceCents: 2000,
      salePriceCents: 3500,
      stockQuantity: 10,
      minStock: 2,
      location: '',
      supplierId: '',
    });
    expect(created.code).toBe('fil-001'); // normalized upstream by the schema
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ stockQuantity: 10 }));
  });

  it('rejects duplicate code', async () => {
    repo.findByCode.mockResolvedValue(makeProduct());
    await expect(
      service.create({
        code: 'FIL-001',
        name: 'Outro',
        description: '',
        costPriceCents: 100,
        salePriceCents: 200,
        stockQuantity: 0,
        minStock: 0,
        location: '',
        supplierId: '',
      }),
    ).rejects.toMatchObject({ code: 'PRODUCT_CODE_ALREADY_EXISTS', status: 409 });
  });

  it('rejects unknown supplier with 404', async () => {
    repo.findByCode.mockResolvedValue(null);
    suppliersRepo.findById.mockResolvedValue(null);
    await expect(
      service.create({
        code: 'ABC-01',
        name: 'Peça',
        description: '',
        costPriceCents: 100,
        salePriceCents: 200,
        stockQuantity: 0,
        minStock: 0,
        location: '',
        supplierId: 'sup_missing',
      }),
    ).rejects.toMatchObject({ code: 'SUPPLIER_NOT_FOUND', status: 404 });
  });

  it('update never touches stockQuantity directly', async () => {
    repo.findById.mockResolvedValue(makeProduct());
    await service.update('prd_1', { salePriceCents: 4200, minStock: 5 });
    const updateArgs = repo.update.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
    expect(updateArgs).toBeDefined();
    expect('stockQuantity' in (updateArgs ?? {})).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// StockService (spec 36 — transactional movements)
// ─────────────────────────────────────────────────────────────

describe('StockService', () => {
  function buildTx(overrides: Partial<Product> = {}) {
    const product = makeProduct(overrides);
    const tx = {
      product: {
        findFirst: vi.fn((): Product | null => product),
        update: vi.fn((args: { data: { stockQuantity: number } }) => {
          product.stockQuantity = args.data.stockQuantity;
          return product;
        }),
      },
      stockMovement: {
        create: vi.fn((args: { data: Partial<StockMovement> }) => makeMovement(args.data)),
      },
    };
    return { tx, product };
  }

  function buildService(tx: ReturnType<typeof buildTx>['tx']): StockService {
    const prisma = {
      $transaction: vi.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    return new StockService(prisma as unknown as PrismaService);
  }

  it('registers an IN movement and updates stock in one transaction', async () => {
    const { tx, product } = buildTx();
    const service = buildService(tx);

    const result = await service.register('usr_1', {
      productId: 'prd_1',
      type: 'IN',
      quantity: 5,
      reason: 'Compra NF 123',
    });

    expect(result.previousStock).toBe(10);
    expect(result.newStock).toBe(15);
    const movementArgs = tx.stockMovement.create.mock.calls[0]?.[0];
    expect(movementArgs?.data).toMatchObject({
      type: 'IN',
      quantity: 5,
      previousStock: 10,
      newStock: 15,
    });
    expect(product.stockQuantity).toBe(15);
  });

  it('rejects an OUT movement that would go below zero (409)', async () => {
    const { tx } = buildTx({ stockQuantity: 3 });
    const service = buildService(tx);

    await expect(
      service.register('usr_1', {
        productId: 'prd_1',
        type: 'OUT',
        quantity: 4,
        reason: 'Peça usada em OS',
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK', status: 409 });
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('ADJUSTMENT defines the new absolute stock', async () => {
    const { tx } = buildTx({ stockQuantity: 99 });
    const service = buildService(tx);

    const result = await service.register('usr_1', {
      productId: 'prd_1',
      type: 'ADJUSTMENT',
      quantity: 2,
      reason: 'Inventário',
    });

    expect(result.previousStock).toBe(99);
    expect(result.newStock).toBe(2);
    expect(tx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stockQuantity: 2 } }),
    );
  });

  it('returns 404 for unknown product', async () => {
    const txBox = buildTx();
    txBox.tx.product.findFirst.mockReturnValue(null);
    const service = buildService(txBox.tx);
    await expect(
      service.register('usr_1', {
        productId: 'missing',
        type: 'IN',
        quantity: 1,
        reason: 'Compra',
      }),
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND', status: 404 });
  });
});
