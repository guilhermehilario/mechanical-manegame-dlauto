import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { HealthController } from './health.controller';

/**
 * Global cross-cutting concerns live here (spec §26, §27, §20):
 *  - structured logging with PII redaction;
 *  - uniform response envelope (success and error);
 *  - rate limiting on every route.
 * Domain modules are imported and stay free of these concerns.
 */
@Module({
  imports: [
    AppLoggingModule,
    PrismaModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuthModule,
    UsersModule,
    CustomersModule,
    VehiclesModule,
    ServicesModule,
    SuppliersModule,
    ProductsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
