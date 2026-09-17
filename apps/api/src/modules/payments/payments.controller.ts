import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createPaymentSchema,
  paymentIdSchema,
  workOrderIdSchema,
} from '@mechanic-system/validation';
import type { CreatePaymentInput } from '@mechanic-system/validation';
import type { PaymentDto, WorkOrderPaymentSummaryDto } from '@mechanic-system/types';
import { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';
import { PaymentsService, type PaymentsList } from './payments.service';

/**
 * Payments (Bloco A). Receiving money is front-desk work — every role may
 * register a payment; reversal touches realized revenue and is ADMIN/MANAGER
 * only. The global JwtAuthGuard (R5) already requires a valid session.
 */
@UseGuards(RolesGuard)
@Controller('work-orders/:workOrderId/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  list(
    @Param('workOrderId', new ZodValidationPipe(workOrderIdSchema, 'param'))
    workOrderId: string,
  ): Promise<PaymentsList> {
    return this.paymentsService.listByWorkOrder(workOrderId);
  }

  @Get('summary')
  summary(
    @Param('workOrderId', new ZodValidationPipe(workOrderIdSchema, 'param'))
    workOrderId: string,
  ): Promise<WorkOrderPaymentSummaryDto> {
    return this.paymentsService.summary(workOrderId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT', 'MECHANIC')
  create(
    @Req() request: AuthenticatedRequest,
    @Param('workOrderId', new ZodValidationPipe(workOrderIdSchema, 'param'))
    workOrderId: string,
    @Body(new ZodValidationPipe(createPaymentSchema)) input: CreatePaymentInput,
  ): Promise<{ payment: PaymentDto }> {
    const userId = request.user?.id;
    if (!userId) {
      return Promise.reject(new Error('Unauthorized'));
    }
    return this.paymentsService.create(workOrderId, input, userId).then((result) => ({
      payment: result.payment,
    }));
  }

  /** Reversal (estorno) — realized money, so management only. */
  @Delete(':paymentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRoles('ADMIN', 'MANAGER')
  async refund(
    @Req() request: AuthenticatedRequest,
    @Param('workOrderId', new ZodValidationPipe(workOrderIdSchema, 'param'))
    workOrderId: string,
    @Param('paymentId', new ZodValidationPipe(paymentIdSchema, 'param'))
    paymentId: string,
  ): Promise<void> {
    const userId = request.user?.id;
    if (!userId) {
      return Promise.reject(new Error('Unauthorized'));
    }
    await this.paymentsService.refund(paymentId, workOrderId, userId);
  }
}
