import { Injectable } from '@nestjs/common';
import type { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Data access for products (spec section 22). No business rules here.
 * Soft delete convention (spec section 34): deletedAt not null hides the
 * record from listings; the row stays for historical work-order items (35).
 *
 * Note: `lowStock` needs a column-vs-column comparison (stockQuantity <=
 * minStock) which Prisma filters cannot express on SQLite, so that specific
 * filter uses a raw query. Everything else stays on the Prisma API.
 */
@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Product | null> {
    return this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
  }

  /** Unique-code lookup ignores soft delete - the code itself is unique. */
  findByCode(code: string): Promise<Product | null> {
    return this.prisma.product.findUnique({ where: { code } });
  }

  private listWhere(
    search: string | undefined,
    supplierId: string | undefined,
    includeInactive: boolean,
  ): Prisma.ProductWhereInput {
    const base: Prisma.ProductWhereInput = {};
    if (!includeInactive) {
      base.deletedAt = null;
      base.active = true;
    }
    if (supplierId) {
      base.supplierId = supplierId;
    }
    if (search) {
      base.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }
    return base;
  }

  list(
    page: number,
    limit: number,
    search?: string,
    supplierId?: string,
    lowStock = false,
    includeInactive = false,
  ): Promise<Product[]> {
    if (lowStock) {
      return this.listLowStockRaw(page, limit, search, includeInactive);
    }
    return this.prisma.product.findMany({
      where: this.listWhere(search, supplierId, includeInactive),
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count(
    search?: string,
    supplierId?: string,
    lowStock = false,
    includeInactive = false,
  ): Promise<number> {
    if (lowStock) {
      return this.countLowStockRaw(search, includeInactive);
    }
    return this.prisma.product.count({
      where: this.listWhere(search, supplierId, includeInactive),
    });
  }

  /** stockQuantity <= minStock — field comparison via raw SQL (SQLite). */
  private async listLowStockRaw(
    page: number,
    limit: number,
    search: string | undefined,
    includeInactive: boolean,
  ): Promise<Product[]> {
    const { whereSql, params } = this.lowStockFilter(search, includeInactive);
    return this.prisma.$queryRawUnsafe<Product[]>(
      `SELECT * FROM "products" ${whereSql} ORDER BY "name" ASC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      (page - 1) * limit,
    );
  }

  private async countLowStockRaw(
    search: string | undefined,
    includeInactive: boolean,
  ): Promise<number> {
    const { whereSql, params } = this.lowStockFilter(search, includeInactive);
    const rows = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM "products" ${whereSql}`,
      ...params,
    );
    const total = rows[0]?.total ?? 0;
    return typeof total === 'number' ? total : Number(total);
  }

  private lowStockFilter(
    search: string | undefined,
    includeInactive: boolean,
  ): { whereSql: string; params: string[] } {
    const conditions: string[] = ['"stockQuantity" <= "minStock"'];
    const params: string[] = [];
    if (!includeInactive) {
      conditions.push('"deletedAt" IS NULL', '"active" = 1');
    }
    if (search) {
      conditions.push('("code" LIKE ? OR "name" LIKE ? OR "description" LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    return { whereSql: `WHERE ${conditions.join(' AND ')}`, params };
  }

  create(data: {
    code: string;
    name: string;
    description: string | null;
    costPriceCents: number;
    salePriceCents: number;
    stockQuantity: number;
    minStock: number;
    location: string | null;
    supplierId: string | null;
  }): Promise<Product> {
    return this.prisma.product.create({ data });
  }

  /**
   * NOTE: `stockQuantity` is intentionally NOT updatable here — every stock
   * change must go through StockService movements (spec section 36).
   */
  update(
    id: string,
    data: Partial<{
      code: string;
      name: string;
      description: string | null;
      costPriceCents: number;
      salePriceCents: number;
      minStock: number;
      location: string | null;
      supplierId: string | null;
      active: boolean;
    }>,
  ): Promise<Product> {
    return this.prisma.product.update({ where: { id }, data });
  }

  /** Soft delete (spec section 34) - keeps the row for history. */
  softDelete(id: string): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }
}
