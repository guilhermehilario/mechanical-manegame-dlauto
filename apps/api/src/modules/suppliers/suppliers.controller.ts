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
  createSupplierSchema,
  supplierIdSchema,
  supplierQuerySchema,
  updateSupplierSchema,
} from '@mechanic-system/validation';
import type {
  CreateSupplierInput,
  SupplierQuery,
  UpdateSupplierInput,
} from '@mechanic-system/validation';
import type { SupplierDto, Paginated } from '@mechanic-system/types';
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';

// Supplier management is back-office work: mechanics do not edit suppliers.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(supplierQuerySchema, 'query')) query: SupplierQuery,
  ): Promise<Paginated<SupplierDto>> {
    return this.suppliersService.list(query.page, query.limit, query.search, query.includeInactive);
  }

  @Get(':id')
  getById(
    @Param('id', new ZodValidationPipe(supplierIdSchema, 'param')) id: string,
  ): Promise<SupplierDto> {
    return this.suppliersService.getById(id);
  }

  @Post()
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT')
  create(
    @Body(new ZodValidationPipe(createSupplierSchema)) input: CreateSupplierInput,
  ): Promise<SupplierDto> {
    return this.suppliersService.create(input);
  }

  @Patch(':id')
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT')
  update(
    @Param('id', new ZodValidationPipe(supplierIdSchema, 'param')) id: string,
    @Body(new ZodValidationPipe(updateSupplierSchema)) input: UpdateSupplierInput,
  ): Promise<SupplierDto> {
    return this.suppliersService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRoles('ADMIN', 'MANAGER')
  async softDelete(
    @Param('id', new ZodValidationPipe(supplierIdSchema, 'param')) id: string,
  ): Promise<void> {
    await this.suppliersService.softDelete(id);
  }
}
