import { Injectable } from '@nestjs/common';
import { WORK_ORDER_STATUSES, computeWorkOrderTotals } from '@mechanic-system/shared';
import type { WorkOrderStatus } from '@mechanic-system/shared';
import type {
  ReportPeriodQuery,
  TopReportQuery,
} from '@mechanic-system/validation';
import type {
  RevenueReportDto,
  RevenueReportRowDto,
  TopItemDto,
  TopItemsReportDto,
  WorkOrderStatusReportDto,
} from '@mechanic-system/types';
import { AnalyticsRepository } from '../analytics/analytics.repository';
import { endOfDay, offsetDays, parseReportDate, startOfDay, toYyyyMmDd } from '../../common/dates';

/**
 * Reports (Fase 8). Always derived queries (spec §14) — revenue counts
 * DELIVERED work orders, dated by the pickup registration (the moment
 * money is realized). Money is integer cents (§18).
 */
@Injectable()
export class ReportsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  private resolvePeriod(
    query: ReportPeriodQuery,
    defaultWindowDays: number,
  ): { from: Date; to: Date } {
    const to = query.to ? endOfDay(parseReportDate(query.to)) : endOfDay(new Date());
    const from = query.from
      ? startOfDay(parseReportDate(query.from))
      : offsetDays(to, -(defaultWindowDays - 1));
    return { from, to };
  }

  async revenue(query: ReportPeriodQuery): Promise<RevenueReportDto> {
    const { from, to } = this.resolvePeriod(query, 30);
    const orders = await this.analyticsRepository.listDeliveredWorkOrders({ from, to });

    const daily = new Map<string, Omit<RevenueReportRowDto, 'date'>>();
    for (const order of orders) {
      const totals = computeWorkOrderTotals(order.serviceItems, order.productItems);
      const key = toYyyyMmDd(order.pickup?.createdAt ?? order.updatedAt);
      const bucket = daily.get(key) ?? {
        workOrderCount: 0,
        servicesCents: 0,
        productsCents: 0,
        discountsCents: 0,
        totalCents: 0,
      };
      bucket.workOrderCount += 1;
      bucket.servicesCents += totals.servicesCents;
      bucket.productsCents += totals.productsCents;
      bucket.discountsCents += totals.discountsCents;
      bucket.totalCents += totals.totalCents;
      daily.set(key, bucket);
    }

    const items: RevenueReportRowDto[] = [...daily.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, bucket]) => ({ date, ...bucket }));

    return {
      from: toYyyyMmDd(from),
      to: toYyyyMmDd(to),
      totalCents: items.reduce((sum, item) => sum + item.totalCents, 0),
      items,
    };
  }

  async topServices(query: TopReportQuery): Promise<TopItemsReportDto> {
    const { from, to } = this.resolvePeriod(query, 30);
    const orders = await this.analyticsRepository.listDeliveredWorkOrders({ from, to });

    const ranking = new Map<string, TopItemDto>();
    for (const order of orders) {
      for (const item of order.serviceItems) {
        const entry = ranking.get(item.serviceName) ?? {
          name: item.serviceName,
          quantity: 0,
          revenueCents: 0,
        };
        entry.quantity += item.quantity;
        entry.revenueCents += item.unitPriceCents * item.quantity;
        ranking.set(item.serviceName, entry);
      }
    }

    return {
      from: toYyyyMmDd(from),
      to: toYyyyMmDd(to),
      items: this.rankedTop(ranking, query.limit),
    };
  }

  async topProducts(query: TopReportQuery): Promise<TopItemsReportDto> {
    const { from, to } = this.resolvePeriod(query, 30);
    const orders = await this.analyticsRepository.listDeliveredWorkOrders({ from, to });

    const ranking = new Map<string, TopItemDto>();
    for (const order of orders) {
      for (const item of order.productItems) {
        const entry = ranking.get(item.productName) ?? {
          name: item.productName,
          quantity: 0,
          revenueCents: 0,
        };
        entry.quantity += item.quantity;
        entry.revenueCents += item.unitPriceCents * item.quantity - item.discountCents;
        ranking.set(item.productName, entry);
      }
    }

    return {
      from: toYyyyMmDd(from),
      to: toYyyyMmDd(to),
      items: this.rankedTop(ranking, query.limit),
    };
  }

  async workOrderStatus(query: ReportPeriodQuery): Promise<WorkOrderStatusReportDto> {
    const { from, to } = this.resolvePeriod(query, 365);
    const rows = await this.analyticsRepository.workOrderCountByStatus({ from, to });
    const byStatus = new Map(rows.map((row) => [row.status, row._count]));

    const items = (WORK_ORDER_STATUSES as readonly WorkOrderStatus[]).map((status) => ({
      status,
      count: byStatus.get(status) ?? 0,
    }));

    return {
      from: toYyyyMmDd(from),
      to: toYyyyMmDd(to),
      items,
    };
  }

  private rankedTop(ranking: Map<string, TopItemDto>, limit: number): TopItemDto[] {
    return [...ranking.values()]
      .sort((a, b) => b.revenueCents - a.revenueCents || b.quantity - a.quantity)
      .slice(0, limit);
  }
}