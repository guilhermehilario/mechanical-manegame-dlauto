import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Appointment, Service, Vehicle } from '@prisma/client';
import { AppointmentsService } from '../src/modules/appointments/appointments.service';
import type { AppointmentsRepository, AppointmentWithRelations } from '../src/modules/appointments/appointments.repository';
import type { VehiclesRepository } from '../src/modules/vehicles/vehicles.repository';
import type { ServicesRepository } from '../src/modules/services/services.repository';
import type { PrismaService } from '../src/prisma/prisma.service';

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'veh_1',
    customerId: 'cus_1',
    plate: 'ABC1D23',
    brand: 'Volkswagen',
    model: 'Gol',
    year: 2020,
    color: null,
    mileage: null,
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'svc_1',
    name: 'Troca de óleo',
    description: null,
    priceCents: 15000,
    estimatedMinutes: 40,
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeAppointment(overrides: Partial<Appointment> = {}): AppointmentWithRelations {
  const base: Appointment = {
    id: 'apt_1',
    customerId: 'cus_1',
    vehicleId: 'veh_1',
    serviceId: 'svc_1',
    scheduledAt: new Date('2026-10-01T10:00:00.000Z'),
    status: 'SCHEDULED',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  return {
    ...base,
    customer: { name: 'João da Silva' },
    vehicle: { plate: 'ABC1D23' },
    service: { name: 'Troca de óleo' },
  };
}

function repoMock() {
  return {
    findById: vi.fn(),
    findConflict: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
    create: vi.fn((_client: unknown, _data: unknown) => makeAppointment()),
    update: vi.fn((_client: unknown, _id: string, data: unknown) =>
      makeAppointment(data as Partial<Appointment>),
    ),
    delete: vi.fn(),
  };
}

const TX = Symbol('tx');

function prismaMock() {
  return {
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(TX)),
  };
}

describe('AppointmentsService', () => {
  let repo: ReturnType<typeof repoMock>;
  let prisma: ReturnType<typeof prismaMock>;
  let vehiclesRepo: { findById: ReturnType<typeof vi.fn> };
  let servicesRepo: { findById: ReturnType<typeof vi.fn> };
  let service: AppointmentsService;

  beforeEach(() => {
    repo = repoMock();
    prisma = prismaMock();
    vehiclesRepo = { findById: vi.fn() };
    servicesRepo = { findById: vi.fn() };
    service = new AppointmentsService(
      repo as unknown as AppointmentsRepository,
      vehiclesRepo as unknown as VehiclesRepository,
      servicesRepo as unknown as ServicesRepository,
      prisma as unknown as PrismaService,
    );
  });

  const baseInput = {
    customerId: 'cus_1',
    vehicleId: 'veh_1',
    serviceId: 'svc_1',
    scheduledAt: '2026-10-01T10:00:00.000Z',
    notes: '',
  };

  it('creates an appointment for an owned vehicle', async () => {
    vehiclesRepo.findById.mockResolvedValue(makeVehicle());
    servicesRepo.findById.mockResolvedValue(makeService());
    repo.findConflict.mockResolvedValue(null);

    const created = await service.create(baseInput);

    expect(created.status).toBe('SCHEDULED');
    expect(created.vehiclePlate).toBe('ABC1D23');
    expect(repo.create).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ vehicleId: 'veh_1', serviceId: 'svc_1' }),
    );
  });

  it('runs the conflict check and the insert in one transaction (race guard)', async () => {
    vehiclesRepo.findById.mockResolvedValue(makeVehicle());
    servicesRepo.findById.mockResolvedValue(makeService());
    repo.findConflict.mockResolvedValue(null);

    await service.create(baseInput);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(repo.findConflict).toHaveBeenCalledWith(
      TX,
      'veh_1',
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('rejects vehicle not owned by the customer (422)', async () => {
    vehiclesRepo.findById.mockResolvedValue(makeVehicle({ customerId: 'cus_other' }));
    await expect(service.create(baseInput)).rejects.toMatchObject({
      code: 'VEHICLE_NOT_OWNED_BY_CUSTOMER',
      status: 422,
    });
  });

  it('rejects unknown vehicle/service with 404', async () => {
    vehiclesRepo.findById.mockResolvedValue(null);
    await expect(service.create(baseInput)).rejects.toMatchObject({
      code: 'VEHICLE_NOT_FOUND',
      status: 404,
    });

    vehiclesRepo.findById.mockResolvedValue(makeVehicle());
    servicesRepo.findById.mockResolvedValue(null);
    await expect(service.create(baseInput)).rejects.toMatchObject({
      code: 'SERVICE_NOT_FOUND',
      status: 404,
    });
  });

  it('rejects conflicting appointment for the same vehicle/time (409)', async () => {
    vehiclesRepo.findById.mockResolvedValue(makeVehicle());
    servicesRepo.findById.mockResolvedValue(makeService());
    repo.findConflict.mockResolvedValue(makeAppointment());

    await expect(service.create(baseInput)).rejects.toMatchObject({
      code: 'APPOINTMENT_CONFLICT',
      status: 409,
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a conflicting reschedule inside the same transaction (race guard)', async () => {
    repo.findById.mockResolvedValue(makeAppointment());
    repo.findConflict.mockResolvedValue(makeAppointment());

    await expect(
      service.update('apt_1', { scheduledAt: '2026-10-02T11:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_CONFLICT', status: 409 });
    expect(repo.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('ignores cancelled/completed appointments in conflict check', async () => {
    vehiclesRepo.findById.mockResolvedValue(makeVehicle());
    servicesRepo.findById.mockResolvedValue(makeService());
    // Repository only returns active statuses; simulate empty result.
    repo.findConflict.mockResolvedValue(null);

    await expect(service.create(baseInput)).resolves.toMatchObject({
      status: 'SCHEDULED',
    });
  });

  it('returns 404 for missing appointment', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toMatchObject({
      code: 'APPOINTMENT_NOT_FOUND',
      status: 404,
    });
  });

  it('reschedules with conflict re-check excluding itself', async () => {
    repo.findById.mockResolvedValue(makeAppointment());
    repo.findConflict.mockResolvedValue(null);

    await service.update('apt_1', { scheduledAt: '2026-10-02T11:00:00.000Z' });

    expect(repo.findConflict).toHaveBeenCalledWith(
      TX,
      'veh_1',
      expect.any(Date),
      expect.any(Date),
      'apt_1',
    );
    expect(repo.update).toHaveBeenCalled();
  });

  it('blocks rescheduling a completed appointment', async () => {
    repo.findById.mockResolvedValue(makeAppointment({ status: 'COMPLETED' }));

    await expect(
      service.update('apt_1', { scheduledAt: '2026-10-02T11:00:00.000Z' }),
    ).rejects.toMatchObject({ code: 'INVALID_APPOINTMENT_TRANSITION', status: 409 });
  });

  it('enforces the state machine on status change (409 on illegal jump)', async () => {
    repo.findById.mockResolvedValue(makeAppointment({ status: 'SCHEDULED' }));

    await expect(
      service.update('apt_1', { status: 'COMPLETED' }),
    ).rejects.toMatchObject({ code: 'INVALID_APPOINTMENT_TRANSITION', status: 409 });

    // Legal: SCHEDULED → CONFIRMED
    await expect(service.update('apt_1', { status: 'CONFIRMED' })).resolves.toMatchObject({
      status: 'CONFIRMED',
    });
  });

  it('transition delegates to update with status only', async () => {
    repo.findById.mockResolvedValue(makeAppointment({ status: 'CONFIRMED' }));
    await expect(service.transition('apt_1', 'IN_PROGRESS')).resolves.toMatchObject({
      status: 'IN_PROGRESS',
    });
  });
});
