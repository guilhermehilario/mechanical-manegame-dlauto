import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createServiceSchema,
  serviceIdSchema,
  serviceQuerySchema,
  updateServiceSchema,
} from '@mechanic-system/validation';
import type {
  CreateServiceInput,
  ServiceQuery,
  UpdateServiceInput,
} from '@mechanic-system/validation';
import type { ServiceDto, Paginated } from '@mechanic-system/types';
import { ServicesService } from './services.service';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';

// Catalog management: read for all roles, write for back-office roles
// (mechanics consume the catalog but do not edit it).
@UseGuards(RolesGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(serviceQuerySchema, 'query')) query: ServiceQuery,
  ): Promise<Paginated<ServiceDto>> {
    return this.servicesService.list(query.page, query.limit, query.search, query.includeInactive);
  }

  @Get(':id')
  getById(
    @Param('id', new ZodValidationPipe(serviceIdSchema, 'param')) id: string,
  ): Promise<ServiceDto> {
    return this.servicesService.getById(id);
  }

  @Post()
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT')
  create(
    @Body(new ZodValidationPipe(createServiceSchema)) input: CreateServiceInput,
  ): Promise<ServiceDto> {
    return this.servicesService.create(input);
  }

  @Patch(':id')
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT')
  update(
    @Param('id', new ZodValidationPipe(serviceIdSchema, 'param')) id: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) input: UpdateServiceInput,
  ): Promise<ServiceDto> {
    return this.servicesService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRoles('ADMIN', 'MANAGER')
  async softDelete(
    @Param('id', new ZodValidationPipe(serviceIdSchema, 'param')) id: string,
  ): Promise<void> {
    await this.servicesService.softDelete(id);
  }
}
