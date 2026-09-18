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
  appointmentIdSchema,
  appointmentQuerySchema,
  createAppointmentSchema,
  transitionAppointmentSchema,
  updateAppointmentSchema,
} from '@mechanic-system/validation';
import type {
  AppointmentQuery,
  CreateAppointmentInput,
  TransitionAppointmentInput,
  UpdateAppointmentInput,
} from '@mechanic-system/validation';
import type { AppointmentDto, Paginated } from '@mechanic-system/types';
import { AppointmentsService } from './appointments.service';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';

// All roles can read/manage appointments (front-desk + mechanics need access).
@UseGuards(RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(appointmentQuerySchema, 'query')) query: AppointmentQuery,
  ): Promise<Paginated<AppointmentDto>> {
    return this.appointmentsService.list(
      query.page,
      query.limit,
      {
        customerId: query.customerId,
        vehicleId: query.vehicleId,
        status: query.status,
        ...(query.from ? { from: new Date(query.from) } : {}),
        ...(query.to ? { to: new Date(query.to) } : {}),
      },
      query.sortBy,
      query.sortDir,
    );
  }

  @Get(':id')
  getById(
    @Param('id', new ZodValidationPipe(appointmentIdSchema, 'param')) id: string,
  ): Promise<AppointmentDto> {
    return this.appointmentsService.getById(id);
  }

  @Post()
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT')
  create(
    @Body(new ZodValidationPipe(createAppointmentSchema)) input: CreateAppointmentInput,
  ): Promise<AppointmentDto> {
    return this.appointmentsService.create(input);
  }

  @Patch(':id')
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT')
  update(
    @Param('id', new ZodValidationPipe(appointmentIdSchema, 'param')) id: string,
    @Body(new ZodValidationPipe(updateAppointmentSchema)) input: UpdateAppointmentInput,
  ): Promise<AppointmentDto> {
    return this.appointmentsService.update(id, input);
  }

  /** Dedicated status-transition endpoint (shared state machine enforced). */
  @Patch(':id/status')
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT', 'MECHANIC')
  async transition(
    @Param('id', new ZodValidationPipe(appointmentIdSchema, 'param')) id: string,
    @Body(new ZodValidationPipe(transitionAppointmentSchema))
    input: TransitionAppointmentInput,
  ): Promise<AppointmentDto> {
    return this.appointmentsService.transition(id, input.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRoles('ADMIN', 'MANAGER')
  async delete(
    @Param('id', new ZodValidationPipe(appointmentIdSchema, 'param')) id: string,
  ): Promise<void> {
    await this.appointmentsService.delete(id);
  }
}
