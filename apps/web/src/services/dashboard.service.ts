import type { DashboardSummaryDto } from '@mechanic-system/types';
import { api } from './auth.service';

/** Landing page KPI summary (Fase 8). */
export function getDashboardSummary(): Promise<DashboardSummaryDto> {
  return api.get<DashboardSummaryDto>('/dashboard/summary');
}