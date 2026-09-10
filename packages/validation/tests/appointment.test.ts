import { describe, expect, it } from 'vitest';
import {
  appointmentQuerySchema,
  createAppointmentSchema,
  updateAppointmentSchema,
} from '../src/index';

const cuid = 'cjld2cjuzh99f1dddddddddd';

describe('appointment schemas', () => {
  it('accepts a valid create payload', () => {
    const parsed = createAppointmentSchema.safeParse({
      customerId: cuid,
      vehicleId: cuid,
      serviceId: cuid,
      scheduledAt: '2026-10-01T10:00:00.000Z',
      notes: 'Cliente pediu revisão',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid dates', () => {
    const parsed = createAppointmentSchema.safeParse({
      customerId: cuid,
      vehicleId: cuid,
      serviceId: cuid,
      scheduledAt: 'não-é-uma-data',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects unknown fields (strict)', () => {
    const parsed = createAppointmentSchema.safeParse({
      customerId: cuid,
      vehicleId: cuid,
      serviceId: cuid,
      scheduledAt: '2026-10-01T10:00:00.000Z',
      status: 'COMPLETED',
    });
    expect(parsed.success).toBe(false);
  });

  it('requires at least one field on update', () => {
    expect(updateAppointmentSchema.safeParse({}).success).toBe(false);
    expect(
      updateAppointmentSchema.safeParse({ scheduledAt: '2026-10-02T10:00:00.000Z' }).success,
    ).toBe(true);
    expect(updateAppointmentSchema.safeParse({ status: 'CONFIRMED' }).success).toBe(true);
  });

  it('coerces query filters', () => {
    const parsed = appointmentQuerySchema.parse({
      customerId: cuid,
      status: 'SCHEDULED',
      page: '2',
      from: '2026-10-01T00:00:00.000Z',
    });
    expect(parsed.page).toBe(2);
    expect(parsed.status).toBe('SCHEDULED');
    expect(parsed.from).toBe('2026-10-01T00:00:00.000Z');
  });
});
