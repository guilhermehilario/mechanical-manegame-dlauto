import { Injectable } from '@nestjs/common';
import type { Prisma, Supplier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Data access for suppliers (spec section 22). No business rules here.
 * Soft delete convention (spec section 34): deletedAt not null hides the
 * record from listings; the row stays for historical purchases/work orders.
 */
@Injectable()
export class SuppliersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Supplier | null> {
    return this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
    });
  }

  /** Unique-CNPJ lookup ignores soft delete - the CNPJ itself is unique. */
  findByCnpj(cnpj: string): Promise<Supplier | null> {
    return this.prisma.supplier.findUnique({ where: { cnpj } });
  }

  private listWhere(
    search: string | undefined,
    includeInactive: boolean,
  ): Prisma.SupplierWhereInput {
    const base: Prisma.SupplierWhereInput = {};
    if (!includeInactive) {
      base.deletedAt = null;
      base.active = true;
    }
    if (search) {
      base.OR = [{ name: { contains: search } }, { cnpj: { contains: search } }];
    }
    return base;
  }

  list(page: number, limit: number, search?: string, includeInactive = false): Promise<Supplier[]> {
    return this.prisma.supplier.findMany({
      where: this.listWhere(search, includeInactive),
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count(search?: string, includeInactive = false): Promise<number> {
    return this.prisma.supplier.count({
      where: this.listWhere(search, includeInactive),
    });
  }

  create(data: {
    name: string;
    cnpj: string;
    phone: string;
    email: string | null;
    address: string | null;
    notes: string | null;
  }): Promise<Supplier> {
    return this.prisma.supplier.create({ data });
  }

  update(
    id: string,
    data: Partial<{
      name: string;
      cnpj: string;
      phone: string;
      email: string | null;
      address: string | null;
      notes: string | null;
      active: boolean;
    }>,
  ): Promise<Supplier> {
    return this.prisma.supplier.update({ where: { id }, data });
  }

  /** Soft delete (spec section 34) - keeps the row for history. */
  softDelete(id: string): Promise<Supplier> {
    return this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }
}
