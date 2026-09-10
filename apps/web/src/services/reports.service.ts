import type {
  RevenueReportDto,
  TopItemsReportDto,
  WorkOrderStatusReportDto,
} from '@mechanic-system/types';
import { api } from './auth.service';

/** Report queries (Fase 8) — periods are inclusive YYYY-MM-DD strings. */

export function getRevenueReport(
  from: string,
  to: string,
): Promise<RevenueReportDto> {
  return api.get<RevenueReportDto>(`/reports/revenue?from=${from}&to=${to}`);
}

export function getTopServices(
  from: string,
  to: string,
  limit = 10,
): Promise<TopItemsReportDto> {
  return api.get<TopItemsReportDto>(
    `/reports/top-services?from=${from}&to=${to}&limit=${limit}`,
  );
}

export function getTopProducts(
  from: string,
  to: string,
  limit = 10,
): Promise<TopItemsReportDto> {
  return api.get<TopItemsReportDto>(
    `/reports/top-products?from=${from}&to=${to}&limit=${limit}`,
  );
}

export function getWorkOrderStatusReport(
  from: string,
  to: string,
): Promise<WorkOrderStatusReportDto> {
  return api.get<WorkOrderStatusReportDto>(`/reports/work-orders?from=${from}&to=${to}`);
}