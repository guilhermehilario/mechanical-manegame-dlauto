import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { AppointmentsRepository } from '../appointments/appointments.repository';
import { ProductsRepository } from '../products/products.repository';
import { CustomersRepository } from '../customers/customers.repository';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [SecurityModule, AnalyticsModule, AppointmentsModule, WorkOrdersModule],
  controllers: [DashboardController],
  providers: [DashboardService, AppointmentsRepository, ProductsRepository, CustomersRepository],
})
export class DashboardModule {}