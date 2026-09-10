import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import type { CreateVehicleInput, UpdateVehicleInput } from '@mechanic-system/validation';
import type { VehicleDto } from '@mechanic-system/types';
import type { Vehicle } from '@prisma/client';
import { VehiclesRepository } from './vehicles.repository';
import { CustomersRepository } from '../customers/customers.repository';

function toDto(vehicle: Vehicle): VehicleDto {
  return {
    id: vehicle.id,
    customerId: vehicle.customerId,
    plate: vehicle.plate,
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    color: vehicle.color,
    mileage: vehicle.mileage,
    active: vehicle.active,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}

@Injectable()
export class VehiclesService {
  constructor(
    private readonly vehiclesRepository: VehiclesRepository,
    private readonly customersRepository: CustomersRepository,
  ) {}

  async create(input: CreateVehicleInput): Promise<VehicleDto> {
    const customer = await this.customersRepository.findById(input.customerId);
    if (!customer) {
      throw new NotFoundError(ErrorCodes.CUSTOMER_NOT_FOUND, 'Cliente não encontrado');
    }
    const existing = await this.vehiclesRepository.findByPlate(input.plate);
    if (existing) {
      throw new ConflictError(ErrorCodes.VEHICLE_PLATE_ALREADY_EXISTS, 'Placa já cadastrada');
    }
    const vehicle = await this.vehiclesRepository.create({
      customerId: input.customerId,
      plate: input.plate,
      brand: input.brand,
      model: input.model,
      year: input.year ?? null,
      color: input.color || null,
      mileage: input.mileage ?? null,
    });
    return toDto(vehicle);
  }

  async list(
    page: number,
    limit: number,
    customerId?: string,
    search?: string,
    includeInactive = false,
  ): Promise<{
    items: VehicleDto[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const [vehicles, total] = await Promise.all([
      this.vehiclesRepository.list(page, limit, customerId, search, includeInactive),
      this.vehiclesRepository.count(customerId, search, includeInactive),
    ]);
    return {
      items: vehicles.map(toDto),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getById(id: string): Promise<VehicleDto> {
    const vehicle = await this.vehiclesRepository.findById(id);
    if (!vehicle) {
      throw new NotFoundError(ErrorCodes.VEHICLE_NOT_FOUND, 'Veículo não encontrado');
    }
    return toDto(vehicle);
  }

  async listByCustomer(customerId: string): Promise<VehicleDto[]> {
    const vehicles = await this.vehiclesRepository.list(1, 100, customerId);
    return vehicles.map(toDto);
  }

  async update(id: string, input: UpdateVehicleInput): Promise<VehicleDto> {
    await this.getById(id);
    if (input.plate) {
      const existing = await this.vehiclesRepository.findByPlate(input.plate);
      if (existing && existing.id !== id) {
        throw new ConflictError(ErrorCodes.VEHICLE_PLATE_ALREADY_EXISTS, 'Placa já cadastrada');
      }
    }
    const vehicle = await this.vehiclesRepository.update(id, {
      ...(input.plate !== undefined ? { plate: input.plate } : {}),
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.year !== undefined ? { year: input.year } : {}),
      ...(input.color !== undefined ? { color: input.color || null } : {}),
      ...(input.mileage !== undefined ? { mileage: input.mileage } : {}),
    });
    return toDto(vehicle);
  }

  /** Soft delete — hides the vehicle from listings (spec §34/§35). */
  async softDelete(id: string): Promise<void> {
    await this.getById(id);
    await this.vehiclesRepository.softDelete(id);
  }
}
