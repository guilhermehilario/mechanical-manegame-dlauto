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
  createVehicleSchema,
  updateVehicleSchema,
  vehicleIdSchema,
  vehicleQuerySchema,
  customerIdSchema,
} from '@mechanic-system/validation';
import type {
  CreateVehicleInput,
  UpdateVehicleInput,
  VehicleQuery,
} from '@mechanic-system/validation';
import type { Paginated, VehicleDto } from '@mechanic-system/types';
import { VehiclesService } from './vehicles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';

// NOTE: global APP_INTERCEPTOR provides the response envelope (spec §27).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(vehicleQuerySchema, 'query')) query: VehicleQuery,
  ): Promise<Paginated<VehicleDto>> {
    return this.vehiclesService.list(
      query.page,
      query.limit,
      query.customerId,
      query.search,
      query.includeInactive,
    );
  }

  @Get(':id')
  getById(
    @Param('id', new ZodValidationPipe(vehicleIdSchema, 'param')) id: string,
  ): Promise<VehicleDto> {
    return this.vehiclesService.getById(id);
  }

  /** Convenience endpoint: all vehicles of one customer (spec §14 layout). */
  @Get('customer/:customerId')
  listByCustomer(
    @Param('customerId', new ZodValidationPipe(customerIdSchema, 'param')) customerId: string,
  ): Promise<VehicleDto[]> {
    return this.vehiclesService.listByCustomer(customerId);
  }

  @Post()
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT')
  create(
    @Body(new ZodValidationPipe(createVehicleSchema)) input: CreateVehicleInput,
  ): Promise<VehicleDto> {
    return this.vehiclesService.create(input);
  }

  @Patch(':id')
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT')
  update(
    @Param('id', new ZodValidationPipe(vehicleIdSchema, 'param')) id: string,
    @Body(new ZodValidationPipe(updateVehicleSchema)) input: UpdateVehicleInput,
  ): Promise<VehicleDto> {
    return this.vehiclesService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRoles('ADMIN', 'MANAGER')
  async softDelete(
    @Param('id', new ZodValidationPipe(vehicleIdSchema, 'param')) id: string,
  ): Promise<void> {
    await this.vehiclesService.softDelete(id);
  }
}
