import { Injectable } from '@nestjs/common';
import type { Prisma, Vehicle } from '@prisma/client';
import { buildOrderBy, type VehicleSortField } from '@mechanic-system/validation';
import { PrismaService } from '../../prisma/prisma.service';

/** Maps the API's whitelisted sort fields to Prisma columns. */
const SORT_FIELD_MAP: Record<VehicleSortField, string> = {
  plate: 'plate',
  brand: 'brand',
  model: 'model',
  year: 'year',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

/**
 * Data access for vehicles (spec §22). No business rules here.
 * Soft delete convention (spec §34): `deletedAt != null` hides the record
 * from listings while keeping it for historical work orders (§35).
 */
@Injectable()
export class VehiclesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Vehicle | null> {
    return this.prisma.vehicle.findFirst({
      where: { id, deletedAt: null },
    });
  }

  /** Unique-plate lookup ignores soft delete — the plate itself is unique. */
  findByPlate(plate: string): Promise<Vehicle | null> {
    return this.prisma.vehicle.findUnique({ where: { plate } });
  }

  private listWhere(
    customerId: string | undefined,
    search: string | undefined,
    includeInactive: boolean,
  ): Prisma.VehicleWhereInput {
    const base: Prisma.VehicleWhereInput = {};
    if (!includeInactive) {
      base.deletedAt = null;
      base.active = true;
    }
    if (customerId) {
      base.customerId = customerId;
    }
    if (search) {
      base.OR = [
        { plate: { contains: search } },
        { brand: { contains: search } },
        { model: { contains: search } },
      ];
    }
    return base;
  }

  list(
    page: number,
    limit: number,
    customerId?: string,
    search?: string,
    includeInactive = false,
    sortBy?: VehicleSortField,
    sortDir?: 'asc' | 'desc',
  ): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: this.listWhere(customerId, search, includeInactive),
      orderBy: buildOrderBy(sortBy, sortDir, SORT_FIELD_MAP, { plate: 'asc' }),
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count(customerId?: string, search?: string, includeInactive = false): Promise<number> {
    return this.prisma.vehicle.count({
      where: this.listWhere(customerId, search, includeInactive),
    });
  }

  create(data: {
    customerId: string;
    plate: string;
    brand: string;
    model: string;
    year: number | null;
    color: string | null;
    mileage: number | null;
  }): Promise<Vehicle> {
    return this.prisma.vehicle.create({ data });
  }

  update(
    id: string,
    data: Partial<{
      plate: string;
      brand: string;
      model: string;
      year: number | null;
      color: string | null;
      mileage: number | null;
      active: boolean;
    }>,
  ): Promise<Vehicle> {
    return this.prisma.vehicle.update({ where: { id }, data });
  }

  /** Soft delete (spec §34) — keeps the row for history. */
  softDelete(id: string): Promise<Vehicle> {
    return this.prisma.vehicle.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }
}
