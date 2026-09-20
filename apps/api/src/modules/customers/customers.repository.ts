import { Injectable } from '@nestjs/common';
import type { Customer, Prisma } from '@prisma/client';
import { buildOrderBy } from '@mechanic-system/validation';
import { PrismaService } from '../../prisma/prisma.service';

/** Maps the API's whitelisted sort fields to Prisma columns. */
const SORT_FIELD_MAP = {
  name: 'name',
  cpf: 'cpf',
  phone: 'phone',
  email: 'email',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
} as const;

/**
 * Data access for customers (spec §22). No business rules here.
 * Soft delete convention (spec §34): `deletedAt != null` removes the record
 * from normal listings while keeping it for historical work orders.
 */
@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
    });
  }

  /** Unique-CPF lookup ignores soft delete — the CPF itself is unique. */
  findByCpf(cpf: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({ where: { cpf } });
  }

  private listWhere(search: string | undefined, includeInactive: boolean): Prisma.CustomerWhereInput {
    const base: Prisma.CustomerWhereInput = {};
    if (!includeInactive) {
      base.deletedAt = null;
      base.active = true;
    }
    if (search) {
      base.OR = [
        { name: { contains: search } },
        { cpf: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    return base;
  }

  list(
    page: number,
    limit: number,
    search?: string,
    includeInactive = false,
    sortBy?: keyof typeof SORT_FIELD_MAP,
    sortDir?: 'asc' | 'desc',
  ): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where: this.listWhere(search, includeInactive),
      orderBy: buildOrderBy(sortBy, sortDir, SORT_FIELD_MAP, { name: 'asc' }),
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count(search?: string, includeInactive = false): Promise<number> {
    return this.prisma.customer.count({
      where: this.listWhere(search, includeInactive),
    });
  }

  create(data: {
    name: string;
    cpf: string;
    phone: string;
    email: string | null;
    address: string | null;
    notes: string | null;
  }): Promise<Customer> {
    return this.prisma.customer.create({ data });
  }

  update(
    id: string,
    data: Partial<{
      name: string;
      cpf: string;
      phone: string;
      email: string | null;
      address: string | null;
      notes: string | null;
      active: boolean;
    }>,
  ): Promise<Customer> {
    return this.prisma.customer.update({ where: { id }, data });
  }

  /** Soft delete (spec §34) — keeps the row for history. */
  softDelete(id: string): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }
}
