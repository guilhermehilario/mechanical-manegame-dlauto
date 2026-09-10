import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createVehiclePickupSchema,
  workOrderPickupIdSchema,
  workOrderIdSchema,
} from '@mechanic-system/validation';
import type { CreateVehiclePickupInput } from '@mechanic-system/validation';
import { paginationQuerySchema } from '@mechanic-system/validation';
import type { PaginationQuery } from '@mechanic-system/validation';
import type { Paginated, VehiclePickupDto } from '@mechanic-system/types';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';
import { VehiclePickupsService } from './vehicle-pickups.service';

/**
 * Vehicle handover (Fase 7). Front desk/mechanics register the receipt;
 * viewing is open to all roles.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicle-pickups')
export class VehiclePickupsController {
  constructor(private readonly pickupsService: VehiclePickupsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema, 'query')) query: PaginationQuery,
  ): Promise<Paginated<VehiclePickupDto>> {
    return this.pickupsService.list(query.page, query.limit);
  }

  /** Receipt for one work order (or 404 when not picked up yet). */
  @Get('work-order/:workOrderId')
  getByWorkOrder(
    @Param('workOrderId', new ZodValidationPipe(workOrderIdSchema, 'param')) workOrderId: string,
  ): Promise<VehiclePickupDto> {
    return this.pickupsService.getByWorkOrder(workOrderId);
  }

  @Post('work-order/:workOrderId')
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT', 'MECHANIC')
  register(
    @Req() request: AuthenticatedRequest,
    @Param('workOrderId', new ZodValidationPipe(workOrderPickupIdSchema, 'param')) workOrderId: string,
    @Body(new ZodValidationPipe(createVehiclePickupSchema)) input: CreateVehiclePickupInput,
  ): Promise<VehiclePickupDto> {
    const userId = request.user?.id ?? null;
    return this.pickupsService.register(workOrderId, input, userId);
  }
}
