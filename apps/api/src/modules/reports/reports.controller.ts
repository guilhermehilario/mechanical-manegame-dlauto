import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  reportPeriodSchema,
  topReportQuerySchema,
} from '@mechanic-system/validation';
import type { ReportPeriodQuery, TopReportQuery } from '@mechanic-system/validation';
import type {
  RevenueReportDto,
  TopItemsReportDto,
  WorkOrderStatusReportDto,
} from '@mechanic-system/types';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';

/**
 * R3 (SEC-02): reports are financial/business data — restricted to
 * management roles for every route of this controller.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireRoles('ADMIN', 'MANAGER')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  revenue(
    @Query(new ZodValidationPipe(reportPeriodSchema, 'query')) query: ReportPeriodQuery,
  ): Promise<RevenueReportDto> {
    return this.reportsService.revenue(query);
  }

  @Get('top-services')
  topServices(
    @Query(new ZodValidationPipe(topReportQuerySchema, 'query')) query: TopReportQuery,
  ): Promise<TopItemsReportDto> {
    return this.reportsService.topServices(query);
  }

  @Get('top-products')
  topProducts(
    @Query(new ZodValidationPipe(topReportQuerySchema, 'query')) query: TopReportQuery,
  ): Promise<TopItemsReportDto> {
    return this.reportsService.topProducts(query);
  }

  @Get('work-orders')
  workOrderStatus(
    @Query(new ZodValidationPipe(reportPeriodSchema, 'query')) query: ReportPeriodQuery,
  ): Promise<WorkOrderStatusReportDto> {
    return this.reportsService.workOrderStatus(query);
  }
}