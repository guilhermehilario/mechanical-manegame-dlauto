import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from '../modules/auth/jwt-auth.guard';
import { SecurityModule } from '../modules/auth/security.module';
import { HardeningModule } from '../common/hardening/hardening.module';
import { BackupModule } from '../common/backup/backup.module';
import { AppLoggingModule } from '../common/logging/logging.module';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { EnvelopeInterceptor } from '../common/interceptors/envelope.interceptor';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../modules/auth/auth.module';
import { UsersModule } from '../modules/users/users.module';
import { CustomersModule } from '../modules/customers/customers.module';
import { VehiclesModule } from '../modules/vehicles/vehicles.module';
import { ServicesModule } from '../modules/services/services.module';
import { SuppliersModule } from '../modules/suppliers/suppliers.module';
import { ProductsModule } from '../modules/products/products.module';
import { AppointmentsModule } from '../modules/appointments/appointments.module';
import { WorkOrdersModule } from '../modules/work-orders/work-orders.module';
import { VehiclePickupsModule } from '../modules/vehicle-pickups/vehicle-pickups.module';
import { AnalyticsModule } from '../modules/analytics/analytics.module';
import { DashboardModule } from '../modules/dashboard/dashboard.module';
import { ReportsModule } from '../modules/reports/reports.module';
import { SettingsModule } from '../modules/settings/settings.module';
import { HealthController } from './health.controller';

/**
 * Global cross-cutting concerns live here (spec §26, §27, §20):
 *  - structured logging with PII redaction;
 *  - uniform response envelope (success and error);
 *  - rate limiting on every route;
 *  - authentication (R5/SEC-05): JwtAuthGuard as APP_GUARD — every route is
 *    protected unless explicitly @Public() (deny-by-default).
 * Domain modules are imported and stay free of these concerns.
 */
@Module({
  imports: [
    AppLoggingModule,
    PrismaModule,
    HardeningModule,
    BackupModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    // Direct import so TokenService (JwtAuthGuard's dep) is visible to the
    // APP_GUARD instantiated in THIS module's injector (R5/SEC-05).
    SecurityModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    VehiclesModule,
    ServicesModule,
    SuppliersModule,
    ProductsModule,
    AppointmentsModule,
    WorkOrdersModule,
    VehiclePickupsModule,
    AnalyticsModule,
    DashboardModule,
    ReportsModule,
    SettingsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    // Guard order matters: Throttler first (cheap, no deps), then auth.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
