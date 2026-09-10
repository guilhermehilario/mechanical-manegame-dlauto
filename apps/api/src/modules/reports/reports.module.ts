import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [SecurityModule, AnalyticsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}