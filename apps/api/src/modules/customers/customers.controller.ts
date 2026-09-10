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
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createCustomerSchema,
  customerIdSchema,
  customerQuerySchema,
  updateCustomerSchema,
} from '@mechanic-system/validation';
import type {
  CreateCustomerInput,
  CustomerQuery,
  UpdateCustomerInput,
} from '@mechanic-system/validation';
import type { CustomerDto, Paginated } from '@mechanic-system/types';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';
import { UseGuards } from '@nestjs/common';

// NOTE: global APP_INTERCEPTOR provides the response envelope (spec §27).
// Every attendant-facing role manages customers (front-desk operation).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(customerQuerySchema, 'query')) query: CustomerQuery,
  ): Promise<Paginated<CustomerDto>> {
    return this.customersService.list(
      query.page,
      query.limit,
      query.search,
      query.includeInactive,
    );
  }

  @Get(':id')
  getById(
    @Param('id', new ZodValidationPipe(customerIdSchema, 'param')) id: string,
  ): Promise<CustomerDto> {
    return this.customersService.getById(id);
  }

  @Post()
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT')
  create(
    @Body(new ZodValidationPipe(createCustomerSchema)) input: CreateCustomerInput,
  ): Promise<CustomerDto> {
    return this.customersService.create(input);
  }

  @Patch(':id')
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT')
  update(
    @Param('id', new ZodValidationPipe(customerIdSchema, 'param')) id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) input: UpdateCustomerInput,
  ): Promise<CustomerDto> {
    return this.customersService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRoles('ADMIN', 'MANAGER')
  async softDelete(
    @Param('id', new ZodValidationPipe(customerIdSchema, 'param')) id: string,
  ): Promise<void> {
    await this.customersService.softDelete(id);
  }
}
