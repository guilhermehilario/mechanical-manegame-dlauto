import { Injectable } from '@nestjs/common';
import type { Prisma, Appointment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ACTIVE_APPOINTMENT_STATUSES } from '@mechanic-system/shared';
import type { AppointmentStatus } from '@mechanic-system/shared';

/** Appointment with the display relations loaded (customer/vehicle/service). */
export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: {
    customer: { select: { name: true } };
    vehicle: { select: { plate: true } };
    service: { select: { name: true } };
  };
}>;

/**
 * Data access for appointments (spec §22). No business rules here.
 * The (vehicleId, scheduledAt) index supports the conflict check (spec §13).
 */
@Injectable()
export class AppointmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<AppointmentWithRelations | null> {
    return this.prisma.appointment.findFirst({
      where: { id },
      include: {
        customer: { select: { name: true } },
        vehicle: { select: { plate: true } },
        service: { select: { name: true } },
      },
    });
  }

  /**
   * Conflict lookup (spec §13): active appointments for the same vehicle
   * whose slot overlaps [start, end). Cancelled/completed do not block.
   * With instant slots (start === end) this reduces to an exact-timestamp
   * match; duration-based windows work without changes once durations exist.
   */
  findConflict(
    vehicleId: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ): Promise<Appointment | null> {
    return this.prisma.appointment.findFirst({
      where: {
        vehicleId,
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        OR: [
          { scheduledAt: { equals: start } },
          ...(start.getTime() !== end.getTime()
            ? [{ scheduledAt: { gte: start, lt: end } }]
            : []),
        ],
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  private listWhere(filters: {
    customerId?: string;
    vehicleId?: string;
    status?: AppointmentStatus;
    from?: Date;
    to?: Date;
  }): Prisma.AppointmentWhereInput {
    const base: Prisma.AppointmentWhereInput = {};
    if (filters.customerId) base.customerId = filters.customerId;
    if (filters.vehicleId) base.vehicleId = filters.vehicleId;
    if (filters.status) base.status = filters.status;
    if (filters.from || filters.to) {
      base.scheduledAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }
    return base;
  }

  list(
    page: number,
    limit: number,
    filters: {
      customerId?: string;
      vehicleId?: string;
      status?: AppointmentStatus;
      from?: Date;
      to?: Date;
    },
  ): Promise<AppointmentWithRelations[]> {
    return this.prisma.appointment.findMany({
      where: this.listWhere(filters),
      orderBy: { scheduledAt: 'asc' },
      include: {
        customer: { select: { name: true } },
        vehicle: { select: { plate: true } },
        service: { select: { name: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count(filters: {
    customerId?: string;
    vehicleId?: string;
    status?: AppointmentStatus;
    from?: Date;
    to?: Date;
  }): Promise<number> {
    return this.prisma.appointment.count({ where: this.listWhere(filters) });
  }

  /** Active-status appointments within an inclusive time window (Fase 8). */
  countActiveBetween(from: Date, to: Date): Promise<number> {
    return this.prisma.appointment.count({
      where: {
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        scheduledAt: { gte: from, lte: to },
      },
    });
  }

  create(data: {
    customerId: string;
    vehicleId: string;
    serviceId: string;
    scheduledAt: Date;
    notes: string | null;
  }): Promise<AppointmentWithRelations> {
    return this.prisma.appointment.create({
      data,
      include: {
        customer: { select: { name: true } },
        vehicle: { select: { plate: true } },
        service: { select: { name: true } },
      },
    });
  }

  update(
    id: string,
    data: Partial<{
      serviceId: string;
      scheduledAt: Date;
      notes: string | null;
      status: AppointmentStatus;
    }>,
  ): Promise<AppointmentWithRelations> {
    return this.prisma.appointment.update({
      where: { id },
      data,
      include: {
        customer: { select: { name: true } },
        vehicle: { select: { plate: true } },
        service: { select: { name: true } },
      },
    });
  }

  /** Soft cancel is modeled by status; hard delete is admin-only cleanup. */
  delete(id: string): Promise<Appointment> {
    return this.prisma.appointment.delete({ where: { id } });
  }
}
