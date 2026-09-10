import { describe, expect, it } from 'vitest';
import {
  addProductItemSchema,
  addServiceItemSchema,
  createWorkOrderSchema,
  updateWorkOrderSchema,
  workOrderStatusBodySchema,
} from '../src/index';

const cuid = 'cjld2cjuzh99f1dddddddddd';

describe('work order schemas', () => {
  it('accepts a valid create payload', () => {
    const parsed = createWorkOrderSchema.safeParse({
      customerId: cuid,
      vehicleId: cuid,
      notes: 'Ruído no freio',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects unknown fields on create (strict)', () => {
    const parsed = createWorkOrderSchema.safeParse({
      customerId: cuid,
      vehicleId: cuid,
      status: 'APPROVED',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects empty update', () => {
    expect(updateWorkOrderSchema.safeParse({}).success).toBe(false);
    expect(updateWorkOrderSchema.safeParse({ notes: 'ok' }).success).toBe(true);
  });

  it('validates service item input', () => {
    expect(
      addServiceItemSchema.safeParse({ serviceId: cuid, quantity: 2 }).success,
    ).toBe(true);
    expect(addServiceItemSchema.safeParse({ serviceId: cuid }).success).toBe(true); // default 1
    expect(
      addServiceItemSchema.safeParse({ serviceId: cuid, quantity: 0 }).success,
    ).toBe(false);
    expect(
      addServiceItemSchema.safeParse({ serviceId: cuid, quantity: 1.5 }).success,
    ).toBe(false);
  });

  it('validates product item input (discount in cents)', () => {
    expect(
      addProductItemSchema.safeParse({ productId: cuid, quantity: 1, discountCents: 0 })
        .success,
    ).toBe(true);
    expect(
      addProductItemSchema.safeParse({ productId: cuid, quantity: 1, discountCents: -1 })
        .success,
    ).toBe(false);
    expect(addProductItemSchema.safeParse({ productId: cuid, quantity: 2 }).success).toBe(
      true,
    );
  });

  it('validates the status transition body', () => {
    expect(workOrderStatusBodySchema.safeParse({ status: 'APPROVED' }).success).toBe(true);
    expect(workOrderStatusBodySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
  });
});
