import { Injectable } from '@nestjs/common';
import type { Prisma, WorkOrder } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ACTIVE_WORK_ORDER_STATUSES } from '@mechanic-system/shared';
import type { WorkOrderStatus } from '@mechanic-system/shared';

/**
 * Delivered work order with the snapshot items (spec §35) plus the pickup
 * timestamp used to date the realized revenue (Fase 8).
 */
export type DeliveredWorkOrder = Prisma.WorkOrderGetPayload<{
  include: {
    serviceItems: true;
    productItems: true;
    pickup: { select: { createdAt: true } };
  };
}>;

const DELIVERED_INCLUDE = {
  serviceItems: { orderBy: { createdAt: 'asc' as const } },
  productItems: { orderBy: { createdAt: 'asc' as const } },
  pickup: { select: { createdAt: true } },
};

/**
 * Derived data access for the dashboard and reports (Fase 8 — spec §14
 * style: everything is a QUERY over existing tables, never new storage).
 * No business rules live here.
 */
@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Work orders still in the shop (not delivered/cancelled). */
  countActiveWorkOrders(): Promise<number> {
    return this.prisma.workOrder.count({
      where: { status: { in: [...ACTIVE_WORK_ORDER_STATUSES] } },
    });
  }

  countAwaitingPickup(): Promise<number> {
    return this.prisma.workOrder.count({ where: { status: 'AWAITING_PICKUP' } });
  }

  /** Work order counts per status, optionally within a created-at window. */
  workOrderCountByStatus(window?: { from?: Date; to?: Date }): Promise<
    Array<{ status: WorkOrderStatus } & { _count: number }>
  > {
    return this.prisma.workOrder
      .groupBy({
        by: ['status'],
        _count: { _all: true },
        ...(window?.from || window?.to
          ? {
              where: {
                createdAt: {
                  ...(window.from ? { gte: window.from } : {}),
                  ...(window.to ? { lte: window.to } : {}),
                },
              },
            }
          : {}),
      })
      .then((rows) =>
        rows.map((row) => ({ status: row.status, _count: row._count._all })),
      );
  }

  /**
   * Delivered work orders (revenue realized) within an inclusive delivery
   * window. Delivery is dated by the pickup registration (createdAt) —
   * the transactional point where the vehicle left the shop (Fase 7).
   */
  listDeliveredWorkOrders(window?: { from?: Date; to?: Date }): Promise<DeliveredWorkOrder[]> {
    return this.prisma.workOrder.findMany({
      where: {
        status: 'DELIVERED',
        ...(window?.from || window?.to
          ? {
              pickup: {
                is: {
                  createdAt: {
                    ...(window.from ? { gte: window.from } : {}),
                    ...(window.to ? { lte: window.to } : {}),
                  },
                },
              },
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: DELIVERED_INCLUDE,
    });
  }
}

/** Raw alias so tests/consumers don't need to touch the Prisma client. */
export type WorkOrderRow = WorkOrder;