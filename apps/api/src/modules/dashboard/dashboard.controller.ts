import { Controller, Get, UseGuards } from '@nestjs/common';
import type { DashboardSummaryDto } from '@mechanic-system/types';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** KPI summary + recent activity for the landing page. */
  @Get('summary')
  summary(): Promise<DashboardSummaryDto> {
    return this.dashboardService.summary();
  }
}