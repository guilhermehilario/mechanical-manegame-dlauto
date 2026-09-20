import { Injectable } from '@nestjs/common';
import type { Prisma, Appointment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ACTIVE_APPOINTMENT_STATUSES } from '@mechanic-system/shared';
import type { AppointmentStatus } from '@mechanic-system/shared';
import { buildOrderBy, type AppointmentSortField } from '@mechanic-system/validation';

/** Maps the API's whitelisted sort fields to Prisma columns. */
const SORT_FIELD_MAP: Record<AppointmentSortField, string> = {
  scheduledAt: 'scheduledAt',
  status: 'status',
  createdAt: 'createdAt',
};

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

const APPOINTMENT_INCLUDE = {
  customer: { select: { name: true } },
  vehicle: { select: { plate: true } },
  service: { select: { name: true } },
} as const;

/** Any client that can run appointment queries: the global PrismaService or
 * a transaction client (conflict check + write share ONE transaction). */
type AppointmentClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AppointmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<AppointmentWithRelations | null> {
    return this.prisma.appointment.findFirst({
      where: { id },
      include: APPOINTMENT_INCLUDE,
    });
  }

  private conflictWhere(
    vehicleId: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ): Prisma.AppointmentWhereInput {
    return {
      vehicleId,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      OR: [
        { scheduledAt: { equals: start } },
        ...(start.getTime() !== end.getTime()
          ? [{ scheduledAt: { gte: start, lt: end } }]
          : []),
      ],
      ...(excludeId ? { id: { not: excludeId } } : {}),
    };
  }

  /**
   * Conflict lookup (spec §13): active appointments for the same vehicle
   * whose slot overlaps [start, end). Cancelled/completed do not block.
   * With instant slots (start === end) this reduces to an exact-timestamp
   * match; duration-based windows work without changes once durations exist.
   *
   * `client` must be the caller's transaction client when the result gates a
   * write — the check and the write then share one transaction (SQLite
   * serializes writers), so two concurrent creates cannot both pass.
   */
  findConflict(
    client: AppointmentClient,
    vehicleId: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ): Promise<Appointment | null> {
    return client.appointment.findFirst({
      where: this.conflictWhere(vehicleId, start, end, excludeId),
      orderBy: { scheduledAt: 'asc' },
    });
  }

  private listWhere(
    filters: {
      customerId?: string;
      vehicleId?: string;
      status?: AppointmentStatus;
      from?: Date;
      to?: Date;
    },
    search?: string,
  ): Prisma.AppointmentWhereInput {
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
    if (!search) return base;
    return {
      ...base,
      OR: [
        { customer: { name: { contains: search } } },
        { vehicle: { plate: { contains: search } } },
        { service: { name: { contains: search } } },
      ],
    };
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
    search?: string,
    sortBy?: AppointmentSortField,
    sortDir?: 'asc' | 'desc',
  ): Promise<AppointmentWithRelations[]> {
    return this.prisma.appointment.findMany({
      where: this.listWhere(filters, search),
      orderBy: buildOrderBy(sortBy, sortDir, SORT_FIELD_MAP, { scheduledAt: 'asc' }),
      include: APPOINTMENT_INCLUDE,
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count(
    filters: {
      customerId?: string;
      vehicleId?: string;
      status?: AppointmentStatus;
      from?: Date;
      to?: Date;
    },
    search?: string,
  ): Promise<number> {
    return this.prisma.appointment.count({ where: this.listWhere(filters, search) });
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

  create(
    client: AppointmentClient,
    data: {
      customerId: string;
      vehicleId: string;
      serviceId: string;
      scheduledAt: Date;
      notes: string | null;
    },
  ): Promise<AppointmentWithRelations> {
    return client.appointment.create({ data, include: APPOINTMENT_INCLUDE });
  }

  update(
    client: AppointmentClient,
    id: string,
    data: Partial<{
      serviceId: string;
      scheduledAt: Date;
      notes: string | null;
      status: AppointmentStatus;
    }>,
  ): Promise<AppointmentWithRelations> {
    return client.appointment.update({
      where: { id },
      data,
      include: APPOINTMENT_INCLUDE,
    });
  }

  /** Soft cancel is modeled by status; hard delete is admin-only cleanup. */
  delete(id: string): Promise<Appointment> {
    return this.prisma.appointment.delete({ where: { id } });
  }
}
