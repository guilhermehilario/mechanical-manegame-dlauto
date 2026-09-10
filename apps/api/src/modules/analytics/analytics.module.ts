import { Module } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository';

/**
 * Derived data (Fase 8 — dashboard + reports). Exposes AnalyticsRepository
 * so both consumers share one source of truth for aggregate queries.
 */
@Module({
  providers: [AnalyticsRepository],
  exports: [AnalyticsRepository],
})
export class AnalyticsModule {}