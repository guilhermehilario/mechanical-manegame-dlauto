import { expect, test } from '@playwright/test';
import { E2eApi } from '../support/api';

/**
 * F3/F4: the optional example catalog (services/products/suppliers).
 *
 * Idempotency is the contract — re-running must never duplicate records and
 * returns the count actually created on this call.
 */

test.describe('seed example catalog (F3/F4)', () => {
  test('populates the example catalog once and stays idempotent on re-run', async () => {
    const api = await E2eApi.create();
    try {
      const first = await api.seedCatalogExample();
      expect(first).toEqual({ services: 10, products: 10, suppliers: 3 });

      const second = await api.seedCatalogExample();
      expect(second).toEqual({ services: 0, products: 0, suppliers: 0 });
    } finally {
      await api.dispose();
    }
  });
});