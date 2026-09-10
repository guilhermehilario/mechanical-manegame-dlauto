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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  addProductItemSchema,
  addServiceItemSchema,
  createWorkOrderSchema,
  updateWorkOrderSchema,
  workOrderIdSchema,
  workOrderItemIdSchema,
  workOrderQuerySchema,
  workOrderStatusBodySchema,
} from '@mechanic-system/validation';
import type {
  AddProductItemInput,
  AddServiceItemInput,
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
  WorkOrderQuery,
  WorkOrderStatusBody,
} from '@mechanic-system/validation';
import type { WorkOrderDto, Paginated } from '@mechanic-system/types';
import { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';
import { WorkOrdersService } from './work-orders.service';

// Mechanics actively work orders (status + items); front desk opens them;
// only ADMIN/MANAGER can hard-delete.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(workOrderQuerySchema, 'query')) query: WorkOrderQuery,
  ): Promise<Paginated<WorkOrderDto>> {
    return this.workOrdersService.list(query.page, query.limit, {
      customerId: query.customerId,
      vehicleId: query.vehicleId,
      status: query.status,
    });
  }

  @Get(':id')
  getById(
    @Param('id', new ZodValidationPipe(workOrderIdSchema, 'param')) id: string,
  ): Promise<WorkOrderDto> {
    return this.workOrdersService.getById(id);
  }

  @Post()
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT')
  create(
    @Body(new ZodValidationPipe(createWorkOrderSchema)) input: CreateWorkOrderInput,
  ): Promise<WorkOrderDto> {
    return this.workOrdersService.create(input);
  }

  @Patch(':id')
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT', 'MECHANIC')
  update(
    @Param('id', new ZodValidationPipe(workOrderIdSchema, 'param')) id: string,
    @Body(new ZodValidationPipe(updateWorkOrderSchema)) input: UpdateWorkOrderInput,
  ): Promise<WorkOrderDto> {
    return this.workOrdersService.update(id, input);
  }

  /** Status transitions follow the shared machine (spec §11). */
  @Patch(':id/status')
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT', 'MECHANIC')
  transition(
    @Param('id', new ZodValidationPipe(workOrderIdSchema, 'param')) id: string,
    @Body(new ZodValidationPipe(workOrderStatusBodySchema)) body: WorkOrderStatusBody,
  ): Promise<WorkOrderDto> {
    return this.workOrdersService.transition(id, body.status);
  }

  @Post(':id/service-items')
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT', 'MECHANIC')
  addServiceItem(
    @Param('id', new ZodValidationPipe(workOrderIdSchema, 'param')) id: string,
    @Body(new ZodValidationPipe(addServiceItemSchema)) input: AddServiceItemInput,
  ): Promise<WorkOrderDto> {
    return this.workOrdersService.addServiceItem(id, input);
  }

  @Post(':id/product-items')
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT', 'MECHANIC')
  addProductItem(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ZodValidationPipe(workOrderIdSchema, 'param')) id: string,
    @Body(new ZodValidationPipe(addProductItemSchema)) input: AddProductItemInput,
  ): Promise<WorkOrderDto> {
    const userId = request.user?.id;
    if (!userId) {
      return Promise.reject(new Error('Unauthorized'));
    }
    return this.workOrdersService.addProductItem(id, input, userId);
  }

  @Delete(':id/service-items/:itemId')
  @HttpCode(HttpStatus.OK)
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT', 'MECHANIC')
  removeServiceItem(
    @Param('id', new ZodValidationPipe(workOrderIdSchema, 'param')) id: string,
    @Param('itemId', new ZodValidationPipe(workOrderItemIdSchema, 'param')) itemId: string,
  ): Promise<WorkOrderDto> {
    return this.workOrdersService.removeServiceItem(id, itemId);
  }

  @Delete(':id/product-items/:itemId')
  @HttpCode(HttpStatus.OK)
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT', 'MECHANIC')
  removeProductItem(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ZodValidationPipe(workOrderIdSchema, 'param')) id: string,
    @Param('itemId', new ZodValidationPipe(workOrderItemIdSchema, 'param')) itemId: string,
  ): Promise<WorkOrderDto> {
    const userId = request.user?.id;
    if (!userId) {
      return Promise.reject(new Error('Unauthorized'));
    }
    return this.workOrdersService.removeProductItem(id, itemId, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRoles('ADMIN', 'MANAGER')
  async delete(
    @Param('id', new ZodValidationPipe(workOrderIdSchema, 'param')) id: string,
  ): Promise<void> {
    await this.workOrdersService.delete(id);
  }
}
