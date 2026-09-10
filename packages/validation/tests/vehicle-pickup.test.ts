import { describe, expect, it } from 'vitest';
import { createVehiclePickupSchema } from '../src/vehicle-pickup';

describe('createVehiclePickupSchema', () => {
  const valid = {
    receiverName: 'Maria Souza',
    receiverDoc: '529.982.247-25',
  };

  it('accepts the minimal payload and normalizes the document', () => {
    const parsed = createVehiclePickupSchema.parse(valid);
    expect(parsed.receiverDoc).toBe('52998224725');
    expect(parsed.receiverName).toBe('Maria Souza');
  });

  it('accepts a CNH-style 11-digit document', () => {
    const parsed = createVehiclePickupSchema.parse({ ...valid, receiverDoc: '12345678901' });
    expect(parsed.receiverDoc).toBe('12345678901');
  });

  it('rejects documents that are not 11 digits', () => {
    for (const doc of ['123', '123456789012', 'abcdefghijk']) {
      expect(createVehiclePickupSchema.safeParse({ ...valid, receiverDoc: doc }).success).toBe(
        false,
      );
    }
  });

  it('rejects short names', () => {
    expect(
      createVehiclePickupSchema.safeParse({ ...valid, receiverName: 'M' }).success,
    ).toBe(false);
  });

  it('normalizes the phone and rejects wrong lengths', () => {
    const parsed = createVehiclePickupSchema.parse({
      ...valid,
      receiverPhone: '(11) 99999-8888',
    });
    expect(parsed.receiverPhone).toBe('11999998888');
    expect(
      createVehiclePickupSchema.safeParse({ ...valid, receiverPhone: '1234' }).success,
    ).toBe(false);
  });

  it('accepts an integer mileage and rejects negatives/decimals', () => {
    expect(createVehiclePickupSchema.parse({ ...valid, mileageKm: 45200 }).mileageKm).toBe(45200);
    expect(
      createVehiclePickupSchema.safeParse({ ...valid, mileageKm: -1 }).success,
    ).toBe(false);
    expect(
      createVehiclePickupSchema.safeParse({ ...valid, mileageKm: 10.5 }).success,
    ).toBe(false);
  });

  it('accepts an optional signature data URL and rejects huge strings', () => {
    const parsed = createVehiclePickupSchema.parse({
      ...valid,
      signatureData: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(parsed.signatureData).toContain('data:image/png');
    expect(
      createVehiclePickupSchema.safeParse({ ...valid, signatureData: 'x'.repeat(500_001) })
        .success,
    ).toBe(false);
  });

  it('is strict — unknown keys are rejected', () => {
    expect(
      createVehiclePickupSchema.safeParse({ ...valid, status: 'DELIVERED' }).success,
    ).toBe(false);
  });
});
