import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesRepository } from './vehicles.repository';
import { VehiclesService } from './vehicles.service';
import { CustomersModule } from '../customers/customers.module';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [SecurityModule, CustomersModule],
  controllers: [VehiclesController],
  providers: [VehiclesRepository, VehiclesService],
  exports: [VehiclesRepository],
})
export class VehiclesModule {}
