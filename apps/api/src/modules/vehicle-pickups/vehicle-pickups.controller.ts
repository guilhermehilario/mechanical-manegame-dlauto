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
  vehiclePickupQuerySchema,
  workOrderPickupIdSchema,
  workOrderIdSchema,
} from '@mechanic-system/validation';
import type { CreateVehiclePickupInput, VehiclePickupQuery } from '@mechanic-system/validation';
import type { Paginated, VehiclePickupDto, VehiclePickupReceiptDto } from '@mechanic-system/types';
import { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';
import { VehiclePickupsService } from './vehicle-pickups.service';

/**
 * Vehicle handover (Fase 7). Front desk/mechanics register the receipt;
 * viewing is open to all roles.
 */
@UseGuards(RolesGuard)
@Controller('vehicle-pickups')
export class VehiclePickupsController {
  constructor(private readonly pickupsService: VehiclePickupsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(vehiclePickupQuerySchema, 'query')) query: VehiclePickupQuery,
  ): Promise<Paginated<VehiclePickupDto>> {
    return this.pickupsService.list(query.page, query.limit, query.sortBy, query.sortDir);
  }

  /** Receipt for one work order (or 404 when not picked up yet). */
  @Get('work-order/:workOrderId')
  getByWorkOrder(
    @Param('workOrderId', new ZodValidationPipe(workOrderIdSchema, 'param')) workOrderId: string,
  ): Promise<VehiclePickupDto> {
    return this.pickupsService.getByWorkOrder(workOrderId);
  }

  /**
   * Full receipt for the printed handover document (Bloco B) — adds the
   * signature data URL + vehicle model + OS total. Authenticated roles only;
   * the signature is PII, so there is no public route.
   */
  @Get('work-order/:workOrderId/receipt')
  getReceipt(
    @Param('workOrderId', new ZodValidationPipe(workOrderIdSchema, 'param')) workOrderId: string,
  ): Promise<VehiclePickupReceiptDto> {
    return this.pickupsService.getReceipt(workOrderId);
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
