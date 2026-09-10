import { describe, expect, it } from 'vitest';
import {
  createProductSchema,
  createServiceSchema,
  createStockMovementSchema,
  createSupplierSchema,
  isValidCnpj,
  productCodeSchema,
  productQuerySchema,
} from '../src/index';

describe('service schemas', () => {
  it('accepts a valid catalog service', () => {
    const parsed = createServiceSchema.safeParse({
      name: 'Troca de óleo',
      description: 'Inclui filtro',
      priceCents: 15000,
      estimatedMinutes: 40,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects float or negative prices', () => {
    for (const priceCents of [1500.5, -1]) {
      const parsed = createServiceSchema.safeParse({ name: 'Troca de óleo', priceCents });
      expect(parsed.success).toBe(false);
    }
  });

  it('rejects estimated minutes outside bounds', () => {
    for (const estimatedMinutes of [0, -5, 60 * 24 * 31]) {
      const parsed = createServiceSchema.safeParse({ name: 'X', priceCents: 100, estimatedMinutes });
      expect(parsed.success).toBe(false);
    }
  });
});

describe('supplier schemas (CNPJ)', () => {
  it('accepts valid CNPJ and normalizes to bare digits', () => {
    const parsed = createSupplierSchema.safeParse({
      name: 'Autopeças LTDA',
      cnpj: '45.723.174/0001-10',
      phone: '(11) 3333-4444',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.cnpj).toBe('45723174000110');
    }
  });

  it('rejects CNPJ with wrong check digits', () => {
    expect(isValidCnpj('45723174000111')).toBe(false);
  });

  it('rejects CNPJ with all same digits', () => {
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidCnpj('457231740001')).toBe(false);
  });
});

describe('product schemas', () => {
  const base = {
    name: 'Filtro de óleo',
    costPriceCents: 2000,
    salePriceCents: 3500,
  };

  it('normalizes code to uppercase without spaces', () => {
    const parsed = productCodeSchema.parse(' fil-001 ');
    expect(parsed).toBe('FIL-001');
  });

  it('accepts product with initial stock', () => {
    const parsed = createProductSchema.safeParse({ ...base, code: 'FIL-001', stockQuantity: 10 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.stockQuantity).toBe(10);
    }
  });

  it('defaults stock and minStock to zero', () => {
    const parsed = createProductSchema.parse({ ...base, code: 'FIL-001' });
    expect(parsed.stockQuantity).toBe(0);
    expect(parsed.minStock).toBe(0);
  });

  it('rejects negative prices', () => {
    const parsed = createProductSchema.safeParse({ ...base, code: 'FIL-001', salePriceCents: -1 });
    expect(parsed.success).toBe(false);
  });

  it('coerces query filters', () => {
    const parsed = productQuerySchema.parse({ lowStock: 'true', page: '2' });
    expect(parsed.lowStock).toBe(true);
    expect(parsed.page).toBe(2);
  });
});

describe('stock movement schemas', () => {
  const productId = 'cjld2cjuzh99f1dddddddddd';

  it('accepts IN/OUT/ADJUSTMENT', () => {
    for (const type of ['IN', 'OUT', 'ADJUSTMENT'] as const) {
      const parsed = createStockMovementSchema.safeParse({
        productId,
        type,
        quantity: 5,
        reason: 'Compra NF 123',
      });
      expect(parsed.success).toBe(true);
    }
  });

  it('rejects zero, negative, and fractional quantities', () => {
    for (const quantity of [0, -2, 1.5]) {
      const parsed = createStockMovementSchema.safeParse({
        productId,
        type: 'IN',
        quantity,
        reason: 'Compra',
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('rejects unknown fields (no direct stock edits through the movement API)', () => {
    const parsed = createStockMovementSchema.safeParse({
      productId,
      type: 'IN',
      quantity: 5,
      reason: 'Compra',
      previousStock: 999,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects short reasons', () => {
    const parsed = createStockMovementSchema.safeParse({
      productId,
      type: 'IN',
      quantity: 5,
      reason: 'x',
    });
    expect(parsed.success).toBe(false);
  });
});
