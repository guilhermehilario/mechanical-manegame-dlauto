import { Injectable } from '@nestjs/common';
import type { SeedCatalogResultDto } from '@mechanic-system/types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SEED_PRODUCTS,
  SEED_SERVICES,
  SEED_SUPPLIERS,
} from './catalog-data';

/**
 * Optional example catalog (Bloco F/F3) — the "first week" accelerator.
 *
 * Disabled by default (the packaged app never runs it): the operator opts in
 * through the UI. Runs inside a single transaction and is idempotent —
 * existing items (service by name, product by unique code, supplier by
 * unique CNPJ) are skipped, so re-running never duplicates data.
 */
@Injectable()
export class CatalogSeedService {
  constructor(private readonly prisma: PrismaService) {}

  async seed(): Promise<SeedCatalogResultDto> {
    const result: SeedCatalogResultDto = { services: 0, products: 0, suppliers: 0 };

    await this.prisma.$transaction(async (tx) => {
      // ── Services: skip any name that already exists (active or soft-deleted).
      const existingServices = new Set(
        (
          await tx.service.findMany({
            where: { name: { in: SEED_SERVICES.map((item) => item.name) } },
            select: { name: true },
          })
        ).map((row) => row.name),
      );
      for (const item of SEED_SERVICES) {
        if (existingServices.has(item.name)) continue;
        await tx.service.create({
          data: {
            name: item.name,
            description: item.description || null,
            priceCents: item.priceCents,
            estimatedMinutes: item.estimatedMinutes,
          },
        });
        result.services += 1;
      }

      // ── Suppliers: unique CNPJ.
      const existingSuppliers = new Set(
        (
          await tx.supplier.findMany({
            where: { cnpj: { in: SEED_SUPPLIERS.map((item) => item.cnpj) } },
            select: { cnpj: true },
          })
        ).map((row) => row.cnpj),
      );
      for (const item of SEED_SUPPLIERS) {
        if (existingSuppliers.has(item.cnpj)) continue;
        await tx.supplier.create({
          data: {
            name: item.name,
            cnpj: item.cnpj,
            phone: item.phone,
            email: item.email || null,
            address: item.address || null,
            notes: item.notes || null,
          },
        });
        result.suppliers += 1;
      }

      // ── Products: unique normalized code.
      const existingCodes = new Set(
        (
          await tx.product.findMany({
            where: { code: { in: SEED_PRODUCTS.map((item) => item.code) } },
            select: { code: true },
          })
        ).map((row) => row.code),
      );
      for (const item of SEED_PRODUCTS) {
        if (existingCodes.has(item.code)) continue;
        await tx.product.create({
          data: {
            code: item.code,
            name: item.name,
            costPriceCents: item.costPriceCents,
            salePriceCents: item.salePriceCents,
            stockQuantity: item.stockQuantity,
            minStock: item.minStock,
            location: item.location,
          },
        });
        result.products += 1;
      }
    });

    return result;
  }
}