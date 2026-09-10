import type { WorkOrderStatusDto } from './work-order';

/**
 * Report DTOs (Fase 8). All reports are derived queries over work orders
 * (§14-style) — revenue counts DELIVERED orders (money actually realized),
 * grouped by the delivery/pickup date. Money is integer cents (§18).
 */

/** One daily bucket of the revenue report. */
export interface RevenueReportRowDto {
  date: string; // YYYY-MM-DD (local day of the workshop)
  workOrderCount: number;
  servicesCents: number;
  productsCents: number;
  discountsCents: number;
  totalCents: number;
}

export interface RevenueReportDto {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  totalCents: number;
  items: RevenueReportRowDto[];
}

/** Ranked catalog entries by revenue/quantity within a period. */
export interface TopItemDto {
  name: string;
  quantity: number;
  revenueCents: number;
}

export interface TopItemsReportDto {
  from: string;
  to: string;
  items: TopItemDto[];
}

export interface WorkOrderStatusReportRowDto {
  status: WorkOrderStatusDto;
  count: number;
}

export interface WorkOrderStatusReportDto {
  from: string;
  to: string;
  items: WorkOrderStatusReportRowDto[];
}