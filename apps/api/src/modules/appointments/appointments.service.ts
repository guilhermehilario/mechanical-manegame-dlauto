import { Injectable } from '@nestjs/common';
import { ConflictError, DomainError, NotFoundError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import { canTransitionAppointment, isActiveAppointmentStatus } from '@mechanic-system/shared';
import type { AppointmentStatus } from '@mechanic-system/shared';
import type {
  AppointmentSortField,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from '@mechanic-system/validation';
import type { AppointmentDto } from '@mechanic-system/types';
import { AppointmentsRepository, type AppointmentWithRelations } from './appointments.repository';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { ServicesRepository } from '../services/services.repository';

function toDto(appointment: AppointmentWithRelations): AppointmentDto {
  return {
    id: appointment.id,
    customerId: appointment.customerId,
    customerName: appointment.customer.name,
    vehicleId: appointment.vehicleId,
    vehiclePlate: appointment.vehicle.plate,
    serviceId: appointment.serviceId,
    serviceName: appointment.service.name,
    scheduledAt: appointment.scheduledAt.toISOString(),
    status: appointment.status,
    notes: appointment.notes,
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  };
}

/**
 * Appointment rules (Fase 4 — spec §13):
 * - customer/vehicle/service must exist and the vehicle must belong to the
 *   informed customer;
 * - conflict check happens on the backend only (never trust the frontend):
 *   one active appointment per vehicle overlapping the same time window → 409;
 * - status changes follow the shared state machine (§33);
 * - rescheduling a completed/cancelled appointment is forbidden.
 */
@Injectable()
export class AppointmentsService {
  constructor(
    private readonly appointmentsRepository: AppointmentsRepository,
    private readonly vehiclesRepository: VehiclesRepository,
    private readonly servicesRepository: ServicesRepository,
  ) {}

  /**
   * Slot window used for conflict checks. Slots are instant (start === end)
   * so two appointments conflict only at the same timestamp for the same
   * vehicle; duration-based windows can be introduced later without API
   * changes (the repository already takes a start/end range).
   */
  private slotEnd(scheduledAt: Date): Date {
    return scheduledAt;
  }

  private assertValidDate(scheduledAt: Date): void {
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new DomainError(ErrorCodes.VALIDATION_ERROR, 'Data/hora inválida', 422);
    }
  }

  private async assertVehicleOwnedByCustomer(
    vehicleId: string,
    customerId: string,
  ): Promise<void> {
    const vehicle = await this.vehiclesRepository.findById(vehicleId);
    if (!vehicle) {
      throw new NotFoundError(ErrorCodes.VEHICLE_NOT_FOUND, 'Veículo não encontrado');
    }
    if (vehicle.customerId !== customerId) {
      throw new DomainError(
        'VEHICLE_NOT_OWNED_BY_CUSTOMER',
        'Veículo não pertence ao cliente informado',
        422,
      );
    }
  }

  private async assertNoConflict(
    vehicleId: string,
    scheduledAt: Date,
    excludeId?: string,
  ): Promise<void> {
    const conflict = await this.appointmentsRepository.findConflict(
      vehicleId,
      scheduledAt,
      this.slotEnd(scheduledAt),
      excludeId,
    );
    if (conflict) {
      throw new ConflictError(
        ErrorCodes.APPOINTMENT_CONFLICT,
        'Veículo já possui um agendamento ativo nesse horário',
        { conflictingAppointmentId: conflict.id, scheduledAt: conflict.scheduledAt.toISOString() },
      );
    }
  }

  private async assertServiceExists(serviceId: string): Promise<void> {
    const service = await this.servicesRepository.findById(serviceId);
    if (!service) {
      throw new NotFoundError(ErrorCodes.SERVICE_NOT_FOUND, 'Serviço não encontrado');
    }
  }

  async create(input: CreateAppointmentInput): Promise<AppointmentDto> {
    const scheduledAt = new Date(input.scheduledAt);
    this.assertValidDate(scheduledAt);
    await this.assertVehicleOwnedByCustomer(input.vehicleId, input.customerId);
    await this.assertServiceExists(input.serviceId);
    await this.assertNoConflict(input.vehicleId, scheduledAt);

    const appointment = await this.appointmentsRepository.create({
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      serviceId: input.serviceId,
      scheduledAt,
      notes: input.notes || null,
    });
    return toDto(appointment);
  }

  async list(
    page: number,
    limit: number,
    filters: {
      customerId?: string;
      vehicleId?: string;
      status?: AppointmentStatus;
      from?: Date;
      to?: Date;
    },
    search?: string,
    sortBy?: AppointmentSortField,
    sortDir?: 'asc' | 'desc',
  ): Promise<{
    items: AppointmentDto[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const [appointments, total] = await Promise.all([
      this.appointmentsRepository.list(page, limit, filters, search, sortBy, sortDir),
      this.appointmentsRepository.count(filters, search),
    ]);
    return {
      items: appointments.map(toDto),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getById(id: string): Promise<AppointmentDto> {
    const appointment = await this.appointmentsRepository.findById(id);
    if (!appointment) {
      throw new NotFoundError(ErrorCodes.APPOINTMENT_NOT_FOUND, 'Agendamento não encontrado');
    }
    return toDto(appointment);
  }

  async update(id: string, input: UpdateAppointmentInput): Promise<AppointmentDto> {
    const current = await this.getById(id);

    const scheduledAt =
      input.scheduledAt !== undefined ? new Date(input.scheduledAt) : undefined;
    if (scheduledAt) {
      this.assertValidDate(scheduledAt);
    }

    const isRescheduling = scheduledAt !== undefined || input.serviceId !== undefined;

    // Rescheduling/completed or cancelled appointments makes no sense.
    if (isRescheduling && !isActiveAppointmentStatus(current.status)) {
      throw new ConflictError(
        ErrorCodes.INVALID_APPOINTMENT_TRANSITION,
        'Não é possível reagendar um agendamento concluído ou cancelado',
      );
    }

    if (input.serviceId !== undefined) {
      await this.assertServiceExists(input.serviceId);
    }

    if (scheduledAt) {
      await this.assertNoConflict(current.vehicleId, scheduledAt, id);
    }

    if (input.status !== undefined && input.status !== current.status) {
      if (!canTransitionAppointment(current.status, input.status)) {
        throw new ConflictError(
          ErrorCodes.INVALID_APPOINTMENT_TRANSITION,
          `Transição de status inválida: ${current.status} → ${input.status}`,
        );
      }
    }

    const updated = await this.appointmentsRepository.update(id, {
      ...(input.scheduledAt !== undefined ? { scheduledAt } : {}),
      ...(input.serviceId !== undefined ? { serviceId: input.serviceId } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(input.status !== undefined && input.status !== current.status
        ? { status: input.status }
        : {}),
    });
    return toDto(updated);
  }

  /** Status-only transition (used by the dedicated transition endpoint). */
  async transition(id: string, to: AppointmentStatus): Promise<AppointmentDto> {
    return this.update(id, { status: to });
  }

  /** Hard delete — admin-only cleanup (appointments have no soft delete). */
  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.appointmentsRepository.delete(id);
  }
}
