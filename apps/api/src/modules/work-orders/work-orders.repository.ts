import { Injectable } from '@nestjs/common';
import type { Prisma, WorkOrder, WorkOrderServiceItem, WorkOrderProductItem } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { WorkOrderStatus } from '@mechanic-system/shared';
import { buildOrderBy, type WorkOrderSortField } from '@mechanic-system/validation';

/** Maps the API's whitelisted sort fields to Prisma columns. */
const SORT_FIELD_MAP: Record<WorkOrderSortField, string> = {
  orderNumber: 'orderNumber',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

/** Work order with items + display relations loaded. */
export type WorkOrderWithRelations = Prisma.WorkOrderGetPayload<{
  include: {
    customer: { select: { name: true } };
    vehicle: { select: { plate: true; brand: true; model: true } };
    serviceItems: true;
    productItems: true;
  };
}>;

export type ServiceItemWithRelations = WorkOrderServiceItem;
export type ProductItemWithRelations = WorkOrderProductItem;

const WORK_ORDER_INCLUDE = {
  customer: { select: { name: true } },
  vehicle: { select: { plate: true, brand: true, model: true } },
  serviceItems: { orderBy: { createdAt: 'asc' as const } },
  productItems: { orderBy: { createdAt: 'asc' as const } },
};

/**
 * Data access for work orders (spec §22). No business rules here.
 * Item rows carry catalog snapshots (§35) — this repository only persists
 * what the service decides.
 */
@Injectable()
export class WorkOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<WorkOrderWithRelations | null> {
    return this.prisma.workOrder.findFirst({
      where: { id },
      include: WORK_ORDER_INCLUDE,
    });
  }

  private listWhere(
    filters: {
      customerId?: string;
      vehicleId?: string;
      status?: WorkOrderStatus;
    },
    search?: string,
  ): Prisma.WorkOrderWhereInput {
    const base: Prisma.WorkOrderWhereInput = {};
    if (filters.customerId) base.customerId = filters.customerId;
    if (filters.vehicleId) base.vehicleId = filters.vehicleId;
    if (filters.status) base.status = filters.status;
    if (!search) return base;
    const orderEquals = /^\d+$/.test(search) ? Number(search) : undefined;
    return {
      ...base,
      OR: [
        ...(orderEquals !== undefined ? [{ orderNumber: { equals: orderEquals } }] : []),
        { customer: { name: { contains: search } } },
        { vehicle: { plate: { contains: search } } },
      ],
    };
  }

  list(
    page: number,
    limit: number,
    filters: { customerId?: string; vehicleId?: string; status?: WorkOrderStatus },
    search?: string,
    sortBy?: WorkOrderSortField,
    sortDir?: 'asc' | 'desc',
  ): Promise<WorkOrderWithRelations[]> {
    return this.prisma.workOrder.findMany({
      where: this.listWhere(filters, search),
      orderBy: buildOrderBy(sortBy, sortDir, SORT_FIELD_MAP, { orderNumber: 'desc' }),
      include: WORK_ORDER_INCLUDE,
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count(
    filters: {
      customerId?: string;
      vehicleId?: string;
      status?: WorkOrderStatus;
    },
    search?: string,
  ): Promise<number> {
    return this.prisma.workOrder.count({ where: this.listWhere(filters, search) });
  }

  /**
   * Derived maintenance history for one vehicle (Fase 6, spec §14): newest
   * first, with snapshot items — history is a QUERY, never a table.
   */
  listByVehicleForHistory(vehicleId: string): Promise<WorkOrderWithRelations[]> {
    return this.prisma.workOrder.findMany({
      where: { vehicleId },
      orderBy: { orderNumber: 'desc' },
      include: WORK_ORDER_INCLUDE,
    });
  }

  /**
   * Creates the OS with its next sequential orderNumber inside the caller's
   * transaction (SQLite single-writer makes MAX+1 safe here).
   */
  async createInTransaction(
    tx: Prisma.TransactionClient,
    data: { customerId: string; vehicleId: string; notes: string | null },
  ): Promise<WorkOrder> {
    const last = await tx.workOrder.findFirst({ orderBy: { orderNumber: 'desc' } });
    const orderNumber = (last?.orderNumber ?? 999) + 1;
    return tx.workOrder.create({ data: { ...data, orderNumber } });
  }

  update(
    id: string,
    data: Partial<{ notes: string | null; status: WorkOrderStatus; approvedAt: Date | null; completedAt: Date | null }>,
  ): Promise<WorkOrder> {
    return this.prisma.workOrder.update({ where: { id }, data });
  }

  /** Snapshot row insert — name/price come from the service (§35). */
  createServiceItemInTransaction(
    tx: Prisma.TransactionClient,
    data: { workOrderId: string; serviceId: string; serviceName: string; unitPriceCents: number; quantity: number },
  ): Promise<WorkOrderServiceItem> {
    return tx.workOrderServiceItem.create({ data });
  }

  createProductItemInTransaction(
    tx: Prisma.TransactionClient,
    data: {
      workOrderId: string;
      productId: string;
      productName: string;
      unitPriceCents: number;
      quantity: number;
      discountCents: number;
    },
  ): Promise<WorkOrderProductItem> {
    return tx.workOrderProductItem.create({ data });
  }

  findServiceItem(id: string): Promise<WorkOrderServiceItem | null> {
    return this.prisma.workOrderServiceItem.findUnique({ where: { id } });
  }

  findProductItem(id: string): Promise<WorkOrderProductItem | null> {
    return this.prisma.workOrderProductItem.findUnique({ where: { id } });
  }

  deleteServiceItem(id: string): Promise<WorkOrderServiceItem> {
    return this.prisma.workOrderServiceItem.delete({ where: { id } });
  }

  /**
   * tx-variant: deleting inside the caller's transaction (required for the
   * product-item flow — a global-client write inside an interactive
   * transaction would deadlock on SQLite's single-writer lock).
   */
  deleteServiceItemInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<WorkOrderServiceItem> {
    return tx.workOrderServiceItem.delete({ where: { id } });
  }

  deleteProductItemInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<WorkOrderProductItem> {
    return tx.workOrderProductItem.delete({ where: { id } });
  }
}
