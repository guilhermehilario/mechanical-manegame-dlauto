import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import {
  canTransition,
  computeWorkOrderTotals,
  isPayableWorkOrderStatus,
  isTerminalWorkOrderStatus,
  isWorkOrderItemsEditable,
  itemLineTotalCents,
} from '@mechanic-system/shared';
import type { WorkOrderStatus } from '@mechanic-system/shared';
import type {
  AddProductItemInput,
  AddServiceItemInput,
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
} from '@mechanic-system/validation';
import type {
  VehicleHistoryEntryDto,
  WorkOrderDto,
  WorkOrderPaymentSummaryDto,
  WorkOrderProductItemDto,
  WorkOrderServiceItemDto,
} from '@mechanic-system/types';
import type { WorkOrderProductItem, WorkOrderServiceItem } from '@prisma/client';
import { WorkOrdersRepository, type WorkOrderWithRelations } from './work-orders.repository';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { ServicesRepository } from '../services/services.repository';
import { ProductsRepository } from '../products/products.repository';
import { StockService } from '../products/stock.service';
import { PaymentsRepository } from '../payments/payments.repository';
import { PrismaService } from '../../prisma/prisma.service';

function toServiceItemDto(item: WorkOrderServiceItem): WorkOrderServiceItemDto {
  return {
    id: item.id,
    serviceId: item.serviceId,
    serviceName: item.serviceName,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
    createdAt: item.createdAt.toISOString(),
  };
}

function toProductItemDto(item: WorkOrderProductItem): WorkOrderProductItemDto {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
    discountCents: item.discountCents,
    createdAt: item.createdAt.toISOString(),
  };
}

function computeTotals(workOrder: WorkOrderWithRelations) {
  return computeWorkOrderTotals(workOrder.serviceItems, workOrder.productItems);
}

function toPaymentSummary(
  totalCents: number,
  paidCents: number | null,
): WorkOrderPaymentSummaryDto | null {
  // null while the OS is not payable yet (no payments expected before then).
  if (paidCents === null) return null;
  const status: WorkOrderPaymentSummaryDto['status'] =
    paidCents <= 0 ? 'UNPAID' : paidCents >= totalCents ? 'PAID' : 'PARTIAL';
  return {
    paidCents,
    balanceCents: Math.max(0, totalCents - paidCents),
    status,
  };
}

function toDto(
  workOrder: WorkOrderWithRelations,
  paidCents: number | null = null,
): WorkOrderDto {
  const totals = computeTotals(workOrder);
  return {
    id: workOrder.id,
    orderNumber: workOrder.orderNumber,
    customerId: workOrder.customerId,
    customerName: workOrder.customer.name,
    vehicleId: workOrder.vehicleId,
    vehiclePlate: workOrder.vehicle.plate,
    vehicleModel: `${workOrder.vehicle.brand} ${workOrder.vehicle.model}`,
    status: workOrder.status,
    notes: workOrder.notes,
    approvedAt: workOrder.approvedAt?.toISOString() ?? null,
    completedAt: workOrder.completedAt?.toISOString() ?? null,
    totals,
    serviceItems: workOrder.serviceItems.map(toServiceItemDto),
    productItems: workOrder.productItems.map(toProductItemDto),
    payment:
      paidCents === null
        ? null
        : toPaymentSummary(totals.totalCents, paidCents),
    createdAt: workOrder.createdAt.toISOString(),
    updatedAt: workOrder.updatedAt.toISOString(),
  };
}

/**
 * Work order rules (Fase 5 — spec §11/§35/§36):
 * - vehicle must belong to the informed customer;
 * - status changes follow the shared machine (§11); only non-terminal orders
 *   can transition;
 * - items carry catalog snapshots (§35) and are editable only while the OS is
 *   OPEN/IN_ASSESSMENT;
 * - adding a product item reserves stock via an OUT movement inside the same
 *   transaction (§36) — insufficient stock rolls back the item;
 * - removing a product item returns stock via an IN movement (same txn).
 */
@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly workOrdersRepository: WorkOrdersRepository,
    private readonly vehiclesRepository: VehiclesRepository,
    private readonly servicesRepository: ServicesRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly stockService: StockService,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly prisma: PrismaService,
  ) {}

  private async getWorkOrderOrThrow(id: string): Promise<WorkOrderWithRelations> {
    const workOrder = await this.workOrdersRepository.findById(id);
    if (!workOrder) {
      throw new NotFoundError(ErrorCodes.WORK_ORDER_NOT_FOUND, 'Ordem de Serviço não encontrada');
    }
    return workOrder;
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
      throw new ConflictError(
        'VEHICLE_NOT_OWNED_BY_CUSTOMER',
        'Veículo não pertence ao cliente informado',
      );
    }
  }

  private async assertItemsEditable(id: string): Promise<WorkOrderWithRelations> {
    const workOrder = await this.getWorkOrderOrThrow(id);
    if (!isWorkOrderItemsEditable(workOrder.status)) {
      throw new ConflictError(
        ErrorCodes.WORK_ORDER_ITEMS_LOCKED,
        `Itens só podem ser editados enquanto a OS está em ${WORK_ORDER_ITEMS_EDITABLE_LABEL}`,
      );
    }
    return workOrder;
  }

  async create(input: CreateWorkOrderInput): Promise<WorkOrderDto> {
    await this.assertVehicleOwnedByCustomer(input.vehicleId, input.customerId);
    const created = await this.prisma.$transaction((tx) =>
      this.workOrdersRepository.createInTransaction(tx, {
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        notes: input.notes || null,
      }),
    );
    const full = await this.getWorkOrderOrThrow(created.id);
    return toDto(full);
  }

  async list(
    page: number,
    limit: number,
    filters: { customerId?: string; vehicleId?: string; status?: WorkOrderStatus },
  ): Promise<{
    items: WorkOrderDto[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const [workOrders, total] = await Promise.all([
      this.workOrdersRepository.list(page, limit, filters),
      this.workOrdersRepository.count(filters),
    ]);
    const items = await Promise.all(
      workOrders.map(async (workOrder) =>
        toDto(workOrder, await this.paidCentsFor(workOrder)),
      ),
    );
    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getById(id: string): Promise<WorkOrderDto> {
    const workOrder = await this.getWorkOrderOrThrow(id);
    return toDto(workOrder, await this.paidCentsFor(workOrder));
  }

  /**
   * Paid sum for the DTO badge (Bloco A). Payments only exist on payable
   * orders — anything else returns null and the UI shows no financial state.
   */
  private async paidCentsFor(workOrder: WorkOrderWithRelations): Promise<number | null> {
    if (!isPayableWorkOrderStatus(workOrder.status)) return null;
    return this.paymentsRepository.paidTotal(workOrder.id);
  }

  async update(id: string, input: UpdateWorkOrderInput): Promise<WorkOrderDto> {
    await this.getWorkOrderOrThrow(id);
    await this.workOrdersRepository.update(id, {
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    });
    return this.getById(id);
  }

  async transition(id: string, to: WorkOrderStatus): Promise<WorkOrderDto> {
    const workOrder = await this.getWorkOrderOrThrow(id);
    if (isTerminalWorkOrderStatus(workOrder.status)) {
      throw new ConflictError(
        ErrorCodes.INVALID_WORK_ORDER_TRANSITION,
        'OS em status final não pode mais ser alterada',
      );
    }
    if (!canTransition(workOrder.status, to)) {
      throw new ConflictError(
        ErrorCodes.INVALID_WORK_ORDER_TRANSITION,
        `Transição de status inválida: ${workOrder.status} → ${to}`,
      );
    }
    await this.workOrdersRepository.update(id, {
      status: to,
      ...(to === 'APPROVED' ? { approvedAt: new Date() } : {}),
      ...(to === 'COMPLETED' ? { completedAt: new Date() } : {}),
    });
    return this.getById(id);
  }

  async addServiceItem(id: string, input: AddServiceItemInput): Promise<WorkOrderDto> {
    await this.assertItemsEditable(id);
    const service = await this.servicesRepository.findById(input.serviceId);
    if (!service) {
      throw new NotFoundError(ErrorCodes.SERVICE_NOT_FOUND, 'Serviço não encontrado');
    }
    await this.prisma.$transaction((tx) =>
      this.workOrdersRepository.createServiceItemInTransaction(tx, {
        workOrderId: id,
        serviceId: service.id,
        serviceName: service.name, // snapshot (§35)
        unitPriceCents: service.priceCents, // snapshot (§35)
        quantity: input.quantity,
      }),
    );
    return this.getById(id);
  }

  /**
   * Adds a product item and reserves the stock in ONE transaction: if stock
   * is insufficient the snapshot row insert rolls back too (spec §36).
   */
  async addProductItem(
    id: string,
    input: AddProductItemInput,
    userId: string,
  ): Promise<WorkOrderDto> {
    await this.assertItemsEditable(id);
    const product = await this.productsRepository.findById(input.productId);
    if (!product) {
      throw new NotFoundError(ErrorCodes.PRODUCT_NOT_FOUND, 'Produto não encontrado');
    }
    if (itemLineTotalCents(product.salePriceCents, input.quantity, input.discountCents) === 0 && input.discountCents > 0) {
      throw new ConflictError(ErrorCodes.VALIDATION_ERROR, 'Desconto cobre o valor total do item');
    }
    await this.prisma.$transaction(async (tx) => {
      await this.workOrdersRepository.createProductItemInTransaction(tx, {
        workOrderId: id,
        productId: product.id,
        productName: product.name, // snapshot (§35)
        unitPriceCents: product.salePriceCents, // snapshot (§35)
        quantity: input.quantity,
        discountCents: input.discountCents,
      });
      await this.stockService.applyInTransaction(tx, userId, {
        productId: product.id,
        type: 'OUT',
        quantity: input.quantity,
        reason: `Reserva para OS ${id}`,
      });
    });
    return this.getById(id);
  }

  /** Removes a service item (items editable only). */
  async removeServiceItem(id: string, itemId: string): Promise<WorkOrderDto> {
    await this.assertItemsEditable(id);
    const item = await this.workOrdersRepository.findServiceItem(itemId);
    if (!item || item.workOrderId !== id) {
      throw new NotFoundError(ErrorCodes.WORK_ORDER_NOT_FOUND, 'Item não encontrado');
    }
    await this.workOrdersRepository.deleteServiceItem(itemId);
    return this.getById(id);
  }

  /** Removes a product item and returns the reserved stock (one txn). */
  async removeProductItem(id: string, itemId: string, userId: string): Promise<WorkOrderDto> {
    await this.assertItemsEditable(id);
    const item = await this.workOrdersRepository.findProductItem(itemId);
    if (!item || item.workOrderId !== id) {
      throw new NotFoundError(ErrorCodes.WORK_ORDER_NOT_FOUND, 'Item não encontrado');
    }
    await this.prisma.$transaction(async (tx) => {
      await this.workOrdersRepository.deleteProductItemInTransaction(tx, itemId);
      await this.stockService.applyInTransaction(tx, userId, {
        productId: item.productId,
        type: 'IN',
        quantity: item.quantity,
        reason: `Estorno de item da OS ${id}`,
      });
    });
    return this.getById(id);
  }

  /**
   * Hard delete — admin-only cleanup. Orders that already closed the cycle
   * with a pickup receipt and/or payments are financial/legal records and
   * are refused with a domain error (the DB also enforces ON DELETE RESTRICT
   * on both relations — this turns the raw Prisma P2003 into a clean 409).
   * Deletable orders (still OPEN/assessment) may hold reserved product stock
   * (§36 OUT movements) — every reserved unit is returned via an IN movement
   * in the same transaction as the delete, so no line goes missing.
   */
  async delete(id: string, userId: string): Promise<void> {
    await this.getWorkOrderOrThrow(id);
    const [pickupsCount, paymentsCount] = await Promise.all([
      this.prisma.vehiclePickup.count({ where: { workOrderId: id } }),
      this.prisma.payment.count({ where: { workOrderId: id } }),
    ]);
    if (pickupsCount > 0) {
      throw new ConflictError(
        ErrorCodes.WORK_ORDER_HAS_FINANCIAL_RECORDS,
        'OS com comprovante de retirada registrado não pode ser excluída',
      );
    }
    if (paymentsCount > 0) {
      throw new ConflictError(
        ErrorCodes.WORK_ORDER_HAS_FINANCIAL_RECORDS,
        'OS com pagamentos registrados não pode ser excluída',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const productItems = await tx.workOrderProductItem.findMany({
        where: { workOrderId: id },
      });
      for (const item of productItems) {
        await this.stockService.applyInTransaction(tx, userId, {
          productId: item.productId,
          type: 'IN',
          quantity: item.quantity,
          reason: `Estorno de estoque por exclusão da OS ${id}`,
        });
      }
      await tx.workOrder.delete({ where: { id } });
    });
  }

  /**
   * Derived maintenance history (Fase 6, spec §14): work-order snapshots for
   * one vehicle, newest first. No separate storage — derived queries only.
   */
  async listVehicleHistory(vehicleId: string): Promise<VehicleHistoryEntryDto[]> {
    const vehicle = await this.vehiclesRepository.findById(vehicleId);
    if (!vehicle) {
      throw new NotFoundError(ErrorCodes.VEHICLE_NOT_FOUND, 'Veículo não encontrado');
    }
    const workOrders = await this.workOrdersRepository.listByVehicleForHistory(vehicleId);
    return workOrders.map((workOrder) => {
      const totals = computeTotals(workOrder);
      return {
        workOrderId: workOrder.id,
        orderNumber: workOrder.orderNumber,
        status: workOrder.status,
        openedAt: workOrder.createdAt.toISOString(),
        completedAt: workOrder.completedAt?.toISOString() ?? null,
        services: workOrder.serviceItems.map((item) => ({
          name: item.serviceName,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
        products: workOrder.productItems.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          discountCents: item.discountCents,
        })),
        totalCents: totals.totalCents,
      };
    });
  }
}

const WORK_ORDER_ITEMS_EDITABLE_LABEL = 'Aberta ou Em Avaliação';
