import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import type {
  CreateSupplierInput,
  SupplierSortField,
  UpdateSupplierInput,
} from '@mechanic-system/validation';
import type { SupplierDto } from '@mechanic-system/types';
import type { Supplier } from '@prisma/client';
import { SuppliersRepository } from './suppliers.repository';

function toDto(supplier: Supplier): SupplierDto {
  return {
    id: supplier.id,
    name: supplier.name,
    cnpj: supplier.cnpj,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    notes: supplier.notes,
    active: supplier.active,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  };
}

@Injectable()
export class SuppliersService {
  constructor(private readonly suppliersRepository: SuppliersRepository) {}

  async create(input: CreateSupplierInput): Promise<SupplierDto> {
    const existing = await this.suppliersRepository.findByCnpj(input.cnpj);
    if (existing) {
      throw new ConflictError(ErrorCodes.CNPJ_ALREADY_EXISTS, 'CNPJ já cadastrado');
    }
    const supplier = await this.suppliersRepository.create({
      name: input.name,
      cnpj: input.cnpj,
      phone: input.phone,
      email: input.email || null,
      address: input.address || null,
      notes: input.notes || null,
    });
    return toDto(supplier);
  }

  async list(
    page: number,
    limit: number,
    search?: string,
    includeInactive = false,
    sortBy?: SupplierSortField,
    sortDir?: 'asc' | 'desc',
  ): Promise<{
    items: SupplierDto[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const [suppliers, total] = await Promise.all([
      this.suppliersRepository.list(page, limit, search, includeInactive, sortBy, sortDir),
      this.suppliersRepository.count(search, includeInactive),
    ]);
    return {
      items: suppliers.map(toDto),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getById(id: string): Promise<SupplierDto> {
    const supplier = await this.suppliersRepository.findById(id);
    if (!supplier) {
      throw new NotFoundError(ErrorCodes.SUPPLIER_NOT_FOUND, 'Fornecedor não encontrado');
    }
    return toDto(supplier);
  }

  async update(id: string, input: UpdateSupplierInput): Promise<SupplierDto> {
    await this.getById(id);
    if (input.cnpj) {
      const existing = await this.suppliersRepository.findByCnpj(input.cnpj);
      if (existing && existing.id !== id) {
        throw new ConflictError(ErrorCodes.CNPJ_ALREADY_EXISTS, 'CNPJ já cadastrado');
      }
    }
    const supplier = await this.suppliersRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.cnpj !== undefined ? { cnpj: input.cnpj } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.address !== undefined ? { address: input.address || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    });
    return toDto(supplier);
  }

  /** Soft delete - hides from listings, keeps the row for history (spec 34/35). */
  async softDelete(id: string): Promise<void> {
    await this.getById(id);
    await this.suppliersRepository.softDelete(id);
  }
}
