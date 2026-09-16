import type { AppointmentDto } from './appointment';
import type { DashboardCashDto } from './reports';
import type { WorkOrderDto, WorkOrderStatusDto } from './work-order';

/**
 * Dashboard summary (Fase 8). Everything here is DERIVED from existing
 * tables — there is no dashboard table (spec §14-style derived data).
 * Money remains integer cents (§18).
 */

export interface WorkOrderStatusCountDto {
  status: WorkOrderStatusDto;
  count: number;
}

export interface LowStockProductDto {
  id: string;
  code: string;
  name: string;
  stockQuantity: number;
  minStock: number;
}

export interface DashboardCountsDto {
  customers: number;
  activeWorkOrders: number;
  awaitingPickup: number;
  todayAppointments: number;
  lowStockProducts: number;
}

export interface DashboardRevenueDto {
  currentMonthCents: number;
  previousMonthCents: number;
}

export interface DashboardSummaryDto {
  counts: DashboardCountsDto;
  /** Accrual view — delivered work orders (Fase 8). */
  revenue: DashboardRevenueDto;
  /** Cash view — money actually received (A5). */
  cash: DashboardCashDto;
  workOrdersByStatus: WorkOrderStatusCountDto[];
  upcomingAppointments: AppointmentDto[];
  recentWorkOrders: WorkOrderDto[];
  lowStockProducts: LowStockProductDto[];
}