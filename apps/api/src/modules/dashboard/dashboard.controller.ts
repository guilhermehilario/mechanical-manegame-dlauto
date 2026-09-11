import { Controller, Get, UseGuards } from '@nestjs/common';
import type { DashboardSummaryDto } from '@mechanic-system/types';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';

/**
 * R3 (SEC-02): the dashboard exposes financial KPIs (revenue, ticket) —
 * restricted to management roles for every route of this controller.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireRoles('ADMIN', 'MANAGER')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** KPI summary + recent activity for the landing page. */
  @Get('summary')
  summary(): Promise<DashboardSummaryDto> {
    return this.dashboardService.summary();
  }
}