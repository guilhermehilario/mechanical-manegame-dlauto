import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Customer, Vehicle } from '@prisma/client';
import { CustomersService } from '../src/modules/customers/customers.service';
import type { CustomersRepository } from '../src/modules/customers/customers.repository';
import { VehiclesService } from '../src/modules/vehicles/vehicles.service';
import type { VehiclesRepository } from '../src/modules/vehicles/vehicles.repository';
import type { CustomersRepository as CustomersRepoForVehicles } from '../src/modules/customers/customers.repository';

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cus_1',
    name: 'João da Silva',
    cpf: '52998224725',
    phone: '11999998888',
    email: 'joao@email.com',
    address: 'Rua das Flores, 123',
    notes: null,
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'veh_1',
    customerId: 'cus_1',
    plate: 'ABC1D23',
    brand: 'Volkswagen',
    model: 'Gol',
    year: 2020,
    color: 'Prata',
    mileage: 45000,
    active: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function customersRepoMock() {
  return {
    findById: vi.fn(),
    findByCpf: vi.fn(),
    list: vi.fn((): Promise<Customer[]> => Promise.resolve([])),
    count: vi.fn((): Promise<number> => Promise.resolve(0)),
    create: vi.fn((data: Record<string, unknown>) => makeCustomer(data as Partial<Customer>)),
    update: vi.fn((id: string, data: Record<string, unknown>) =>
      makeCustomer({ id, ...data }),
    ),
    softDelete: vi.fn((id: string) => makeCustomer({ id, deletedAt: new Date(), active: false })),
  };
}

function vehiclesRepoMock() {
  return {
    findById: vi.fn(),
    findByPlate: vi.fn(),
    list: vi.fn((): Promise<Vehicle[]> => Promise.resolve([])),
    count: vi.fn((): Promise<number> => Promise.resolve(0)),
    create: vi.fn((data: Record<string, unknown>) => makeVehicle(data as Partial<Vehicle>)),
    update: vi.fn((id: string, data: Record<string, unknown>) => makeVehicle({ id, ...data })),
    softDelete: vi.fn((id: string) => makeVehicle({ id, deletedAt: new Date(), active: false })),
  };
}

// ─────────────────────────────────────────────────────────────
// CustomersService
// ─────────────────────────────────────────────────────────────

describe('CustomersService', () => {
  let repo: ReturnType<typeof customersRepoMock>;
  let service: CustomersService;

  beforeEach(() => {
    repo = customersRepoMock();
    service = new CustomersService(repo as unknown as CustomersRepository);
  });

  it('creates a customer', async () => {
    repo.findByCpf.mockResolvedValue(null);

    const customer = await service.create({
      name: 'João da Silva',
      cpf: '529.982.247-25',
      phone: '(11) 99999-8888',
      email: 'joao@email.com',
      address: '',
      notes: '',
    });

    expect(customer.name).toBe('João da Silva');
    // CPF is normalized to bare digits by the validation schema before the service.
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ cpf: '529.982.247-25', email: 'joao@email.com' }),
    );
    expect(customer).not.toHaveProperty('deletedAt');
  });

  it('rejects duplicate CPF', async () => {
    repo.findByCpf.mockResolvedValue(makeCustomer());
    await expect(
      service.create({
        name: 'Outro',
        cpf: '52998224725',
        phone: '11999998888',
      }),
    ).rejects.toMatchObject({ code: 'CPF_ALREADY_EXISTS', status: 409 });
  });

  it('returns 404 for missing customer', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toMatchObject({
      code: 'CUSTOMER_NOT_FOUND',
      status: 404,
    });
  });

  it('does not flag own CPF as duplicate on update', async () => {
    repo.findById.mockResolvedValue(makeCustomer());
    repo.findByCpf.mockResolvedValue(makeCustomer({ id: 'cus_1' }));

    const updated = await service.update('cus_1', { phone: '11888887777' });

    expect(updated.phone).toBe('11888887777');
  });

  it('rejects update when CPF belongs to another customer', async () => {
    repo.findById.mockResolvedValue(makeCustomer());
    repo.findByCpf.mockResolvedValue(makeCustomer({ id: 'cus_other' }));
    await expect(service.update('cus_1', { cpf: '52998224725' })).rejects.toMatchObject({
      code: 'CPF_ALREADY_EXISTS',
    });
  });

  it('soft delete hides and deactivates the customer', async () => {
    repo.findById.mockResolvedValue(makeCustomer());
    await service.softDelete('cus_1');
    expect(repo.softDelete).toHaveBeenCalledWith('cus_1');
  });
});

// ─────────────────────────────────────────────────────────────
// VehiclesService
// ─────────────────────────────────────────────────────────────

describe('VehiclesService', () => {
  let vehiclesRepo: ReturnType<typeof vehiclesRepoMock>;
  let customersRepo: ReturnType<typeof customersRepoMock>;
  let service: VehiclesService;

  beforeEach(() => {
    vehiclesRepo = vehiclesRepoMock();
    customersRepo = customersRepoMock();
    service = new VehiclesService(
      vehiclesRepo as unknown as VehiclesRepository,
      customersRepo as unknown as CustomersRepoForVehicles,
    );
  });

  it('creates a vehicle for an existing customer', async () => {
    customersRepo.findById.mockResolvedValue(makeCustomer());
    vehiclesRepo.findByPlate.mockResolvedValue(null);

    const vehicle = await service.create({
      customerId: 'cus_1',
      plate: 'abc1d23',
      brand: 'Volkswagen',
      model: 'Gol',
      year: 2020,
    });

    expect(vehicle.plate).toBe('abc1d23'); // normalized upstream by the schema
    expect(vehiclesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_1', plate: 'abc1d23' }),
    );
  });

  it('rejects vehicle for unknown customer', async () => {
    customersRepo.findById.mockResolvedValue(null);
    await expect(
      service.create({
        customerId: 'missing',
        plate: 'ABC1D23',
        brand: 'Fiat',
        model: 'Uno',
      }),
    ).rejects.toMatchObject({ code: 'CUSTOMER_NOT_FOUND', status: 404 });
  });

  it('rejects duplicate plate', async () => {
    customersRepo.findById.mockResolvedValue(makeCustomer());
    vehiclesRepo.findByPlate.mockResolvedValue(makeVehicle());
    await expect(
      service.create({
        customerId: 'cus_1',
        plate: 'ABC1D23',
        brand: 'Fiat',
        model: 'Uno',
      }),
    ).rejects.toMatchObject({ code: 'VEHICLE_PLATE_ALREADY_EXISTS', status: 409 });
  });

  it('does not flag own plate as duplicate on update', async () => {
    vehiclesRepo.findById.mockResolvedValue(makeVehicle());
    vehiclesRepo.findByPlate.mockResolvedValue(makeVehicle({ id: 'veh_1' }));

    const updated = await service.update('veh_1', { mileage: 46000 });

    expect(updated.mileage).toBe(46000);
  });

  it('returns 404 for missing vehicle', async () => {
    vehiclesRepo.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toMatchObject({
      code: 'VEHICLE_NOT_FOUND',
      status: 404,
    });
  });

  it('lists vehicles by customer', async () => {
    vehiclesRepo.list.mockResolvedValue([makeVehicle()]);
    const items = await service.listByCustomer('cus_1');
    expect(items).toHaveLength(1);
    expect(items[0]?.customerId).toBe('cus_1');
  });
});
