import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import { computeWorkOrderTotals } from '@mechanic-system/shared';
import type {
  CreateVehiclePickupInput,
  VehiclePickupSortField,
} from '@mechanic-system/validation';
import type { VehiclePickupDto, VehiclePickupReceiptDto } from '@mechanic-system/types';
import type { VehiclePickupWithRelations } from './vehicle-pickups.repository';
import { VehiclePickupsRepository } from './vehicle-pickups.repository';
import { WorkOrdersRepository } from '../work-orders/work-orders.repository';
import { PrismaService } from '../../prisma/prisma.service';

function toDto(pickup: VehiclePickupWithRelations): VehiclePickupDto {
  return {
    id: pickup.id,
    workOrderId: pickup.workOrderId,
    orderNumber: pickup.workOrder.orderNumber,
    customerName: pickup.workOrder.customer.name,
    vehiclePlate: pickup.workOrder.vehicle.plate,
    receiverName: pickup.receiverName,
    receiverDoc: pickup.receiverDoc,
    receiverPhone: pickup.receiverPhone,
    mileageKm: pickup.mileageKm,
    hasSignature: pickup.signatureData !== null,
    notes: pickup.notes,
    registeredByName: pickup.registeredByUser?.name ?? null,
    createdAt: pickup.createdAt.toISOString(),
  };
}

/**
 * Pickup rules (Fase 7):
 * - only a work order in AWAITING_PICKUP can receive a pickup receipt;
 * - registering the receipt and moving the OS to DELIVERED happen in ONE
 *   transaction — a half-registered delivery can never exist;
 * - the receipt is immutable (1─1): a second registration is a 409.
 */
@Injectable()
export class VehiclePickupsService {
  constructor(
    private readonly pickupsRepository: VehiclePickupsRepository,
    private readonly workOrdersRepository: WorkOrdersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async register(
    workOrderId: string,
    input: CreateVehiclePickupInput,
    userId: string | null,
  ): Promise<VehiclePickupDto> {
    const workOrder = await this.workOrdersRepository.findById(workOrderId);
    if (!workOrder) {
      throw new NotFoundError(ErrorCodes.WORK_ORDER_NOT_FOUND, 'Ordem de Serviço não encontrada');
    }
    if (workOrder.status !== 'AWAITING_PICKUP') {
      throw new ConflictError(
        ErrorCodes.WORK_ORDER_NOT_AWAITING_PICKUP,
        `Só é possível registrar a retirada de uma OS em Aguardando Retirada (atual: ${workOrder.status})`,
      );
    }
    const existing = await this.pickupsRepository.findByWorkOrderId(workOrderId);
    if (existing) {
      throw new ConflictError(
        ErrorCodes.PICKUP_ALREADY_EXISTS,
        'A retirada desta OS já foi registrada',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const pickup = await this.pickupsRepository.createInTransaction(tx, {
        workOrderId,
        receiverName: input.receiverName,
        receiverDoc: input.receiverDoc,
        receiverPhone: input.receiverPhone && input.receiverPhone.length > 0 ? input.receiverPhone : null,
        mileageKm: input.mileageKm ?? null,
        signatureData: input.signatureData && input.signatureData.length > 0 ? input.signatureData : null,
        notes: input.notes && input.notes.length > 0 ? input.notes : null,
        registeredBy: userId,
      });
      await tx.workOrder.update({
        where: { id: workOrderId },
        data: { status: 'DELIVERED' },
      });
      return pickup;
    });

    const full = await this.pickupsRepository.findById(created.id);
    if (!full) {
      throw new NotFoundError(ErrorCodes.NOT_FOUND, 'Registro de retirada não encontrado');
    }
    return toDto(full);
  }

  async list(
    page: number,
    limit: number,
    search?: string,
    sortBy?: VehiclePickupSortField,
    sortDir?: 'asc' | 'desc',
  ): Promise<{ items: VehiclePickupDto[]; page: number; limit: number; total: number; totalPages: number }> {
    const [pickups, total] = await Promise.all([
      this.pickupsRepository.list(page, limit, search, sortBy, sortDir),
      this.pickupsRepository.count(search),
    ]);
    return {
      items: pickups.map(toDto),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getByWorkOrder(workOrderId: string): Promise<VehiclePickupDto> {
    const pickup = await this.pickupsRepository.findByWorkOrderId(workOrderId);
    if (!pickup) {
      throw new NotFoundError(ErrorCodes.NOT_FOUND, 'Retirada não registrada para esta OS');
    }
    const full = await this.pickupsRepository.findById(pickup.id);
    if (!full) {
      throw new NotFoundError(ErrorCodes.NOT_FOUND, 'Registro de retirada não encontrado');
    }
    return toDto(full);
  }

  /**
   * Full receipt for the PRINTED document (Bloco B) — adds the signature
   * data URL, vehicle brand/model and the work-order total.
   */
  async getReceipt(workOrderId: string): Promise<VehiclePickupReceiptDto> {
    const pickup = await this.pickupsRepository.findReceiptByWorkOrderId(workOrderId);
    if (!pickup) {
      throw new NotFoundError(ErrorCodes.NOT_FOUND, 'Retirada não registrada para esta OS');
    }
    const totals = computeWorkOrderTotals(
      pickup.workOrder.serviceItems,
      pickup.workOrder.productItems,
    );
    return {
      ...toDto(pickup),
      signatureData: pickup.signatureData,
      vehicleModel: `${pickup.workOrder.vehicle.brand} ${pickup.workOrder.vehicle.model}`,
      workOrderTotalCents: totals.totalCents,
    };
  }
}
