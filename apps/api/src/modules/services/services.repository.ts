import { Injectable } from '@nestjs/common';
import type { Prisma, Service } from '@prisma/client';
import { buildOrderBy, type ServiceSortField } from '@mechanic-system/validation';
import { PrismaService } from '../../prisma/prisma.service';

/** Maps the API's whitelisted sort fields to Prisma columns. */
const SORT_FIELD_MAP: Record<ServiceSortField, string> = {
  name: 'name',
  priceCents: 'priceCents',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

/**
 * Data access for the service catalog (spec section 22). No business rules.
 * Soft delete (spec section 34): deletedAt not null hides the record from
 * listings; the row stays for historical work-order snapshots (section 35).
 */
@Injectable()
export class ServicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Service | null> {
    return this.prisma.service.findFirst({
      where: { id, deletedAt: null },
    });
  }

  private listWhere(
    search: string | undefined,
    includeInactive: boolean,
  ): Prisma.ServiceWhereInput {
    const base: Prisma.ServiceWhereInput = {};
    if (!includeInactive) {
      base.deletedAt = null;
      base.active = true;
    }
    if (search) {
      base.OR = [{ name: { contains: search } }, { description: { contains: search } }];
    }
    return base;
  }

  list(
    page: number,
    limit: number,
    search?: string,
    includeInactive = false,
    sortBy?: ServiceSortField,
    sortDir?: 'asc' | 'desc',
  ): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: this.listWhere(search, includeInactive),
      orderBy: buildOrderBy(sortBy, sortDir, SORT_FIELD_MAP, { name: 'asc' }),
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count(search?: string, includeInactive = false): Promise<number> {
    return this.prisma.service.count({
      where: this.listWhere(search, includeInactive),
    });
  }

  create(data: {
    name: string;
    description: string | null;
    priceCents: number;
    estimatedMinutes: number | null;
  }): Promise<Service> {
    return this.prisma.service.create({ data });
  }

  update(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      priceCents: number;
      estimatedMinutes: number | null;
      active: boolean;
    }>,
  ): Promise<Service> {
    return this.prisma.service.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<Service> {
    return this.prisma.service.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }
}
