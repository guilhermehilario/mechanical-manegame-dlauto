import { Injectable } from '@nestjs/common';
import type { Prisma, VehiclePickup } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Pickup row with display relations for listing. */
export type VehiclePickupWithRelations = Prisma.VehiclePickupGetPayload<{
  include: {
    workOrder: {
      select: {
        orderNumber: true;
        customer: { select: { name: true } };
        vehicle: { select: { plate: true } };
      };
    };
    registeredByUser: { select: { name: true } };
  };
}>;

/**
 * Data access for vehicle pickups (Fase 7). No business rules here.
 */
@Injectable()
export class VehiclePickupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 1─1 lookup by the work order. */
  findByWorkOrderId(workOrderId: string): Promise<VehiclePickup | null> {
    return this.prisma.vehiclePickup.findUnique({ where: { workOrderId } });
  }

  findById(id: string): Promise<VehiclePickupWithRelations | null> {
    return this.prisma.vehiclePickup.findFirst({
      where: { id },
      include: PICKUP_INCLUDE,
    });
  }

  list(page: number, limit: number): Promise<VehiclePickupWithRelations[]> {
    return this.prisma.vehiclePickup.findMany({
      orderBy: { createdAt: 'desc' },
      include: PICKUP_INCLUDE,
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count(): Promise<number> {
    return this.prisma.vehiclePickup.count();
  }

  /**
   * Inserts the receipt inside the caller's transaction — the service commits
   * the row and the OS status change atomically (all-or-nothing, spec §36
   * pattern reused from the stock flow).
   */
  createInTransaction(
    tx: Prisma.TransactionClient,
    data: {
      workOrderId: string;
      receiverName: string;
      receiverDoc: string;
      receiverPhone: string | null;
      mileageKm: number | null;
      signatureData: string | null;
      notes: string | null;
      registeredBy: string | null;
    },
  ): Promise<VehiclePickup> {
    return tx.vehiclePickup.create({ data });
  }
}

const PICKUP_INCLUDE = {
  workOrder: {
    select: {
      orderNumber: true,
      customer: { select: { name: true } },
      vehicle: { select: { plate: true } },
    },
  },
  registeredByUser: { select: { name: true } },
};
