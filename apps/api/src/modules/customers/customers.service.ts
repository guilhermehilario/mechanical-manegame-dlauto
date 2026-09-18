import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import type { CreateCustomerInput, CustomerSortField, UpdateCustomerInput } from '@mechanic-system/validation';
import type { CustomerDto } from '@mechanic-system/types';
import type { Customer } from '@prisma/client';
import { CustomersRepository } from './customers.repository';

function toDto(customer: Customer): CustomerDto {
  return {
    id: customer.id,
    name: customer.name,
    cpf: customer.cpf,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    notes: customer.notes,
    active: customer.active,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

@Injectable()
export class CustomersService {
  constructor(private readonly customersRepository: CustomersRepository) {}

  async create(input: CreateCustomerInput): Promise<CustomerDto> {
    const existing = await this.customersRepository.findByCpf(input.cpf);
    if (existing) {
      throw new ConflictError(ErrorCodes.CPF_ALREADY_EXISTS, 'CPF já cadastrado');
    }
    const customer = await this.customersRepository.create({
      name: input.name,
      cpf: input.cpf,
      phone: input.phone,
      email: input.email || null,
      address: input.address || null,
      notes: input.notes || null,
    });
    return toDto(customer);
  }

  async list(
    page: number,
    limit: number,
    search?: string,
    includeInactive = false,
    sortBy?: CustomerSortField,
    sortDir?: 'asc' | 'desc',
  ): Promise<{
    items: CustomerDto[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const [customers, total] = await Promise.all([
      this.customersRepository.list(page, limit, search, includeInactive, sortBy, sortDir),
      this.customersRepository.count(search, includeInactive),
    ]);
    return {
      items: customers.map(toDto),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getById(id: string): Promise<CustomerDto> {
    const customer = await this.customersRepository.findById(id);
    if (!customer) {
      throw new NotFoundError(ErrorCodes.CUSTOMER_NOT_FOUND, 'Cliente não encontrado');
    }
    return toDto(customer);
  }

  async update(id: string, input: UpdateCustomerInput): Promise<CustomerDto> {
    await this.getById(id);
    if (input.cpf) {
      const existing = await this.customersRepository.findByCpf(input.cpf);
      if (existing && existing.id !== id) {
        throw new ConflictError(ErrorCodes.CPF_ALREADY_EXISTS, 'CPF já cadastrado');
      }
    }
    const customer = await this.customersRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.cpf !== undefined ? { cpf: input.cpf } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.address !== undefined ? { address: input.address || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    });
    return toDto(customer);
  }

  /** Logical deactivation — keeps the customer visible as "inactive" (spec §34). */
  async deactivate(id: string): Promise<void> {
    await this.getById(id);
    await this.customersRepository.update(id, { active: false });
  }

  /** Soft delete — hides the customer from listings (spec §34/§35). */
  async softDelete(id: string): Promise<void> {
    await this.getById(id);
    await this.customersRepository.softDelete(id);
  }
}
