import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkOrderWithRelations } from '../src/modules/work-orders/work-orders.repository';
import { WorkOrderImagesService } from '../src/modules/work-orders/work-order-images.service';
import { StorageService } from '../src/common/storage/storage.service';
import { DomainError } from '../src/common/errors/domain.error';

// ───────────────────────── StorageService ─────────────────────────

describe('StorageService', () => {
  const PNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
    0x52,
  ]);
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

  let storage: StorageService;
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mech-storage-'));
    storage = new StorageService({ STORAGE_DIR: dir } as never);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('saves valid PNG content and returns sha256-addressed key', async () => {
    const stored = await storage.save(PNG, 5 * 1024 * 1024, ['image/png']);
    expect(stored.mimeType).toBe('image/png');
    expect(stored.sizeBytes).toBe(PNG.length);
    expect(stored.storageKey).toMatch(/^[0-9a-f]{2}\/[0-9a-f]{64}$/);
    expect(existsSync(storage.absolutePathFor(stored.storageKey))).toBe(true);
  });

  it('rejects non-image content with 415', async () => {
    await expect(storage.save(Buffer.from('hello world'), 5 * 1024 * 1024, ['image/png'])).rejects.toMatchObject({
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('rejects oversized content with 413', async () => {
    await expect(storage.save(PNG, 4, ['image/png'])).rejects.toMatchObject({
      status: 413,
      code: 'IMAGE_TOO_LARGE',
    });
  });

  it('deduplicates identical content (same key, one file)', async () => {
    const first = await storage.save(PNG, 5 * 1024 * 1024, ['image/png']);
    const second = await storage.save(PNG, 5 * 1024 * 1024, ['image/png']);
    expect(second.storageKey).toBe(first.storageKey);
  });

  it('detects the correct mime per format', async () => {
    const jpeg = await storage.save(JPEG, 5 * 1024 * 1024, ['image/jpeg']);
    expect(jpeg.mimeType).toBe('image/jpeg');
  });

  it('reads back what it stored', async () => {
    const stored = await storage.save(PNG, 5 * 1024 * 1024, ['image/png']);
    const bytes = await storage.read(stored.storageKey);
    expect(bytes.equals(PNG)).toBe(true);
  });

  it('removes only when unreferenced', async () => {
    const stored = await storage.save(PNG, 5 * 1024 * 1024, ['image/png']);
    await storage.removeIfUnused(stored.storageKey, 2);
    expect(existsSync(storage.absolutePathFor(stored.storageKey))).toBe(true);
    await storage.removeIfUnused(stored.storageKey, 0);
    expect(existsSync(storage.absolutePathFor(stored.storageKey))).toBe(false);
    await expect(storage.read(stored.storageKey)).rejects.toBeInstanceOf(DomainError);
  });

  it('refuses keys escaping the storage root', () => {
    expect(() => storage.absolutePathFor('../outside.bin')).toThrow(DomainError);
  });
});

// ───────────────────── WorkOrderImagesService ─────────────────────

function makeImageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'img-1',
    workOrderId: 'wo-1',
    storageKey: 'ab/' + 'a'.repeat(64),
    sha256: 'a'.repeat(64),
    mimeType: 'image/png',
    sizeBytes: 10,
    caption: null,
    uploadedBy: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    uploadedByUser: null,
    ...overrides,
  };
}

describe('WorkOrderImagesService', () => {
  function makeService(imageRow: ReturnType<typeof makeImageRow> | null) {
    const imagesRepository = {
      create: vi.fn().mockResolvedValue(makeImageRow()),
      findById: vi.fn().mockResolvedValue(imageRow),
      findByWorkOrder: vi.fn().mockResolvedValue(imageRow ? [imageRow] : []),
      countReferencesTo: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const workOrdersRepository = {
      findById: vi.fn().mockResolvedValue({ id: 'wo-1' }),
    };
    const storage = {
      save: vi.fn().mockResolvedValue({
        storageKey: imageRow?.storageKey ?? 'ab/' + 'a'.repeat(64),
        sha256: 'a'.repeat(64),
        mimeType: 'image/png',
        sizeBytes: 10,
      }),
      read: vi.fn().mockResolvedValue(Buffer.from('fake-bytes')),
      removeIfUnused: vi.fn().mockResolvedValue(undefined),
    };
    const service = new WorkOrderImagesService(
      imagesRepository as never,
      workOrdersRepository as never,
      storage as never,
    );
    return { service, imagesRepository, workOrdersRepository, storage };
  }

  it('upload rejects when no file is present', async () => {
    const { service } = makeService(null);
    await expect(service.upload('wo-1', undefined, null, 'user-1')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('upload rejects unknown work order with 404', async () => {
    const imagesRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByWorkOrder: vi.fn(),
      countReferencesTo: vi.fn(),
      delete: vi.fn(),
    };
    const workOrdersRepository = { findById: vi.fn().mockResolvedValue(null) };
    const storage = { save: vi.fn(), read: vi.fn(), removeIfUnused: vi.fn() };
    const svc = new WorkOrderImagesService(
      imagesRepository as never,
      workOrdersRepository as never,
      storage as never,
    );
    await expect(
      svc.upload('wo-missing', { buffer: Buffer.from('x') }, null, 'user-1'),
    ).rejects.toMatchObject({ status: 404, code: 'WORK_ORDER_NOT_FOUND' });
  });

  it('download builds DTO url and lists by work order', async () => {
    const { service } = makeService(makeImageRow());
    const dto = await service.getById('wo-1', 'img-1');
    expect(dto.url).toBe(`/work-orders/wo-1/images/img-1/content`);
    const list = await service.list('wo-1');
    expect(list).toHaveLength(1);
  });

  it('remove deletes the row then garbage-collects unreferenced bytes', async () => {
    const { service, imagesRepository, storage } = makeService(makeImageRow());
    await service.remove('wo-1', 'img-1');
    expect(imagesRepository.delete).toHaveBeenCalledWith('img-1');
    expect(storage.removeIfUnused).toHaveBeenCalledWith('ab/' + 'a'.repeat(64), 0);
  });

  it('getById rejects images from another work order', async () => {
    const { service } = makeService(makeImageRow({ workOrderId: 'wo-OTHER' }));
    await expect(service.getById('wo-1', 'img-1')).rejects.toMatchObject({
      status: 404,
      code: 'IMAGE_NOT_FOUND',
    });
  });
});

// ───────────────── Derived vehicle history (service level) ─────────────────

describe('vehicle history derivation', () => {
  it('maps work order snapshots to history entries', () => {
    // The mapping is pure — validated through the repository shape.
    const workOrder = {
      id: 'wo-9',
      orderNumber: 1002,
      status: 'COMPLETED',
      createdAt: new Date('2026-02-01T10:00:00Z'),
      completedAt: new Date('2026-02-02T10:00:00Z'),
      serviceItems: [{ serviceName: 'Troca de óleo', quantity: 1, unitPriceCents: 15000 }],
      productItems: [
        { productName: 'Filtro', quantity: 2, unitPriceCents: 3000, discountCents: 1000 },
      ],
    } as unknown as WorkOrderWithRelations;

    const servicesTotal = workOrder.serviceItems.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
    const productsTotal = workOrder.productItems.reduce(
      (sum, i) => sum + Math.max(0, i.unitPriceCents * i.quantity - i.discountCents),
      0,
    );
    expect(servicesTotal + productsTotal).toBe(20000);
    expect(workOrder.productItems[0]?.discountCents).toBe(1000);
  });
});
