import type { WorkOrderPaymentSummaryDto } from './payment';

/**
 * Work order DTOs (Fase 5). Snapshot items are returned as stored — the
 * API never recomputes history (spec §35). Money is integer cents (§18).
 */

export interface WorkOrderServiceItemDto {
  id: string;
  serviceId: string;
  serviceName: string;
  unitPriceCents: number;
  quantity: number;
  createdAt: string;
}

export interface WorkOrderProductItemDto {
  id: string;
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  discountCents: number;
  createdAt: string;
}

export type WorkOrderStatusDto =
  | 'OPEN'
  | 'IN_ASSESSMENT'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'IN_EXECUTION'
  | 'AWAITING_PARTS'
  | 'COMPLETED'
  | 'AWAITING_PICKUP'
  | 'DELIVERED'
  | 'CANCELLED';

export interface WorkOrderTotalsDto {
  servicesCents: number;
  productsCents: number;
  discountsCents: number;
  totalCents: number;
}

export interface WorkOrderDto {
  id: string;
  orderNumber: number;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  status: WorkOrderStatusDto;
  notes: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  totals: WorkOrderTotalsDto;
  serviceItems: WorkOrderServiceItemDto[];
  productItems: WorkOrderProductItemDto[];
  /** Financial summary (Bloco A) — null while the OS is not payable yet. */
  payment: WorkOrderPaymentSummaryDto | null;
  createdAt: string;
  updatedAt: string;
}
