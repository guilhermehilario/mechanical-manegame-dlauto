import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import type { CreateProductInput, UpdateProductInput } from '@mechanic-system/validation';
import type { ProductDto } from '@mechanic-system/types';
import type { Product, Supplier } from '@prisma/client';
import { ProductsRepository } from './products.repository';
import { SuppliersRepository } from '../suppliers/suppliers.repository';

function toDto(product: Product, supplier?: Supplier | null): ProductDto {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    costPriceCents: product.costPriceCents,
    salePriceCents: product.salePriceCents,
    stockQuantity: product.stockQuantity,
    minStock: product.minStock,
    location: product.location,
    supplierId: product.supplierId,
    supplierName: supplier === undefined ? undefined : (supplier?.name ?? null),
    active: product.active,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

/**
 * Product catalog rules (spec 18/22/25/34/35):
 * - money in integer cents;
 * - code unique and uppercase;
 * - `stockQuantity` is never directly editable: the initial stock (create)
 *   and any later change go through StockService movements (spec 36);
 * - supplier must exist when provided (404 otherwise).
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly suppliersRepository: SuppliersRepository,
  ) {}

  async create(input: CreateProductInput): Promise<ProductDto> {
    const existing = await this.productsRepository.findByCode(input.code);
    if (existing) {
      throw new ConflictError(
        ErrorCodes.PRODUCT_CODE_ALREADY_EXISTS,
        'Código de produto já cadastrado',
      );
    }
    let supplier: Supplier | null = null;
    if (input.supplierId) {
      supplier = await this.suppliersRepository.findById(input.supplierId);
      if (!supplier) {
        throw new NotFoundError(ErrorCodes.SUPPLIER_NOT_FOUND, 'Fornecedor não encontrado');
      }
    }
    const product = await this.productsRepository.create({
      code: input.code,
      name: input.name,
      description: input.description || null,
      costPriceCents: input.costPriceCents,
      salePriceCents: input.salePriceCents,
      stockQuantity: input.stockQuantity,
      minStock: input.minStock,
      location: input.location || null,
      supplierId: input.supplierId || null,
    });
    return toDto(product, supplier);
  }

  async list(
    page: number,
    limit: number,
    search?: string,
    supplierId?: string,
    lowStock = false,
    includeInactive = false,
  ): Promise<{
    items: ProductDto[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const [products, total] = await Promise.all([
      this.productsRepository.list(page, limit, search, supplierId, lowStock, includeInactive),
      this.productsRepository.count(search, supplierId, lowStock, includeInactive),
    ]);
    return {
      items: products.map((product) => toDto(product)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getById(id: string): Promise<ProductDto> {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundError(ErrorCodes.PRODUCT_NOT_FOUND, 'Produto não encontrado');
    }
    return toDto(product);
  }

  async update(id: string, input: UpdateProductInput): Promise<ProductDto> {
    await this.getById(id);
    if (input.code) {
      const existing = await this.productsRepository.findByCode(input.code);
      if (existing && existing.id !== id) {
        throw new ConflictError(
          ErrorCodes.PRODUCT_CODE_ALREADY_EXISTS,
          'Código de produto já cadastrado',
        );
      }
    }
    if (input.supplierId) {
      const supplier = await this.suppliersRepository.findById(input.supplierId);
      if (!supplier) {
        throw new NotFoundError(ErrorCodes.SUPPLIER_NOT_FOUND, 'Fornecedor não encontrado');
      }
    }
    const product = await this.productsRepository.update(id, {
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.costPriceCents !== undefined ? { costPriceCents: input.costPriceCents } : {}),
      ...(input.salePriceCents !== undefined ? { salePriceCents: input.salePriceCents } : {}),
      ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
      ...(input.location !== undefined ? { location: input.location || null } : {}),
      ...(input.supplierId !== undefined ? { supplierId: input.supplierId || null } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    });
    return toDto(product);
  }

  /** Soft delete - hides from listings, keeps the row for history (spec 34/35). */
  async softDelete(id: string): Promise<void> {
    await this.getById(id);
    await this.productsRepository.softDelete(id);
  }
}
