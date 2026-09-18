import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import type {
  CreateServiceInput,
  ServiceSortField,
  UpdateServiceInput,
} from '@mechanic-system/validation';
import type { ServiceDto } from '@mechanic-system/types';
import type { Service } from '@prisma/client';
import { ServicesRepository } from './services.repository';

function toDto(service: Service): ServiceDto {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    priceCents: service.priceCents,
    estimatedMinutes: service.estimatedMinutes,
    active: service.active,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

/**
 * Service catalog business rules. Prices are always integer cents (spec 18).
 * Editing the catalog never rewrites historical work orders: they carry
 * their own price snapshot (spec 35).
 */
@Injectable()
export class ServicesService {
  constructor(private readonly servicesRepository: ServicesRepository) {}

  async create(input: CreateServiceInput): Promise<ServiceDto> {
    const service = await this.servicesRepository.create({
      name: input.name,
      description: input.description || null,
      priceCents: input.priceCents,
      estimatedMinutes: input.estimatedMinutes ?? null,
    });
    return toDto(service);
  }

  async list(
    page: number,
    limit: number,
    search?: string,
    includeInactive = false,
    sortBy?: ServiceSortField,
    sortDir?: 'asc' | 'desc',
  ): Promise<{
    items: ServiceDto[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const [services, total] = await Promise.all([
      this.servicesRepository.list(page, limit, search, includeInactive, sortBy, sortDir),
      this.servicesRepository.count(search, includeInactive),
    ]);
    return {
      items: services.map(toDto),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getById(id: string): Promise<ServiceDto> {
    const service = await this.servicesRepository.findById(id);
    if (!service) {
      throw new NotFoundError(ErrorCodes.SERVICE_NOT_FOUND, 'Serviço não encontrado');
    }
    return toDto(service);
  }

  async update(id: string, input: UpdateServiceInput): Promise<ServiceDto> {
    await this.getById(id);
    const service = await this.servicesRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
      ...(input.estimatedMinutes !== undefined
        ? { estimatedMinutes: input.estimatedMinutes ?? null }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    });
    return toDto(service);
  }

  /** Soft delete - hides from listings, keeps the row for history (spec 34/35). */
  async softDelete(id: string): Promise<void> {
    await this.getById(id);
    await this.servicesRepository.softDelete(id);
  }
}
