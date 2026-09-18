import { Injectable } from '@nestjs/common';
import { sumTotalsSources, isActiveAppointmentStatus } from '@mechanic-system/shared';
import type { DashboardSummaryDto } from '@mechanic-system/types';
import { AnalyticsRepository } from '../analytics/analytics.repository';
import { AppointmentsRepository } from '../appointments/appointments.repository';
import { AppointmentsService } from '../appointments/appointments.service';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { ProductsRepository } from '../products/products.repository';
import { CustomersRepository } from '../customers/customers.repository';
import { endOfDay, endOfMonth, offsetMonth, startOfDay, startOfMonth } from '../../common/dates';

/**
 * Dashboard summary (Fase 8). Read-only derived data (spec §14 style):
 * every value is a query over existing tables. Money stays in cents (§18).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly appointmentsRepository: AppointmentsRepository,
    private readonly appointmentsService: AppointmentsService,
    private readonly workOrdersService: WorkOrdersService,
    private readonly productsRepository: ProductsRepository,
    private readonly customersRepository: CustomersRepository,
  ) {}

  async summary(): Promise<DashboardSummaryDto> {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const previousMonthStart = offsetMonth(now, -1);

    const [
      customers,
      activeWorkOrders,
      awaitingPickup,
      todayAppointments,
      lowStockTotal,
      currentMonthRevenue,
      previousMonthRevenue,
      cashToday,
      cashMonth,
      paymentMethods,
      statusRows,
      recentWorkOrders,
      upcomingPage,
      lowStockProducts,
    ] = await Promise.all([
      this.customersRepository.count(),
      this.analyticsRepository.countActiveWorkOrders(),
      this.analyticsRepository.countAwaitingPickup(),
      this.appointmentsRepository.countActiveBetween(startOfDay(now), endOfDay(now)),
      this.productsRepository.count(undefined, undefined, true),
      this.deliveredRevenue(monthStart, endOfMonth(now)),
      this.deliveredRevenue(previousMonthStart, endOfMonth(previousMonthStart)),
      this.analyticsRepository.paymentTotal({ from: startOfDay(now), to: endOfDay(now) }),
      this.analyticsRepository.paymentTotal({ from: monthStart, to: endOfMonth(now) }),
      this.analyticsRepository.paymentTotalsByMethod({ from: monthStart, to: endOfMonth(now) }),
      this.analyticsRepository.workOrderCountByStatus(),
      this.workOrdersService.list(1, 5, {}),
      this.appointmentsService.list(1, 12, { from: now }),
      this.productsRepository.list(1, 5, undefined, undefined, true),
    ]);

    const upcomingAppointments = upcomingPage.items
      .filter((appointment) => isActiveAppointmentStatus(appointment.status))
      .slice(0, 6);

    const workOrdersByStatus = statusRows
      .map((row) => ({ status: row.status, count: row._count }))
      .sort((a, b) => b.count - a.count);

    return {
      counts: {
        customers,
        activeWorkOrders,
        awaitingPickup,
        todayAppointments,
        lowStockProducts: lowStockTotal,
      },
      revenue: {
        currentMonthCents: currentMonthRevenue,
        previousMonthCents: previousMonthRevenue,
      },
      cash: {
        todayCents: cashToday,
        monthCents: cashMonth,
      },
      paymentMethods,
      workOrdersByStatus,
      upcomingAppointments,
      recentWorkOrders: recentWorkOrders.items,
      lowStockProducts: lowStockProducts.map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        stockQuantity: product.stockQuantity,
        minStock: product.minStock,
      })),
    };
  }

  private async deliveredRevenue(from: Date, to: Date): Promise<number> {
    const orders = await this.analyticsRepository.listDeliveredWorkOrders({ from, to });
    return sumTotalsSources(orders).totalCents;
  }
}