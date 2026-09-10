import { describe, expect, it } from 'vitest';
import {
  createCustomerSchema,
  createVehicleSchema,
  customerQuerySchema,
  vehicleQuerySchema,
} from '../src/index';

describe('customer schemas', () => {
  it('normalizes masked CPF to bare digits', () => {
    const parsed = createCustomerSchema.safeParse({
      name: 'João da Silva',
      cpf: '529.982.247-25',
      phone: '(11) 99999-8888',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.cpf).toBe('52998224725');
      expect(parsed.data.email).toBeUndefined();
    }
  });

  it('rejects CPF with wrong check digits', () => {
    const parsed = createCustomerSchema.safeParse({
      name: 'João da Silva',
      cpf: '52998224726',
      phone: '11999998888',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects CPF with all same digits', () => {
    const parsed = createCustomerSchema.safeParse({
      name: 'João da Silva',
      cpf: '111.111.111-11',
      phone: '11999998888',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects short names and malformed phones', () => {
    expect(
      createCustomerSchema.safeParse({ name: 'J', cpf: '52998224725', phone: '11999998888' })
        .success,
    ).toBe(false);
    expect(
      createCustomerSchema.safeParse({ name: 'João', cpf: '52998224725', phone: 'abc##123' })
        .success,
    ).toBe(false);
  });

  it('parses includeInactive from query string coercion', () => {
    expect(customerQuerySchema.parse({ includeInactive: 'true' }).includeInactive).toBe(true);
  });
});

describe('vehicle schemas', () => {
  const baseCustomer = { customerId: 'cjld2cjuzh99f1dddddddddd' };

  it('accepts old and Mercosul plates and normalizes them', () => {
    for (const plate of ['abc1234', 'ABC-1234', 'bcd3d21', 'BCD*3D21']) {
      const parsed = createVehicleSchema.safeParse({
        ...baseCustomer,
        plate,
        brand: 'Volkswagen',
        model: 'Gol',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.plate).toBe(plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
      }
    }
  });

  it('rejects invalid plates', () => {
    for (const plate of ['AB12345', 'ABCD123', 'ABC12', '1234567', 'ABC1D2']) {
      const parsed = createVehicleSchema.safeParse({
        ...baseCustomer,
        plate,
        brand: 'Volkswagen',
        model: 'Gol',
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('rejects years outside plausible range', () => {
    const currentYear = new Date().getFullYear();
    for (const year of [1949, currentYear + 2]) {
      const parsed = createVehicleSchema.safeParse({
        ...baseCustomer,
        plate: 'ABC1234',
        brand: 'Volkswagen',
        model: 'Gol',
        year,
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('coerces numeric string query filters', () => {
    const parsed = vehicleQuerySchema.parse({ customerId: 'cjld2cjuzh99f1dddddddddd', page: '3' });
    expect(parsed.page).toBe(3);
    expect(parsed.customerId).toBe('cjld2cjuzh99f1dddddddddd');
  });
});
