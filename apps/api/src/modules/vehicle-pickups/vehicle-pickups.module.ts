import { Module } from '@nestjs/common';
import { VehiclePickupsController } from './vehicle-pickups.controller';
import { VehiclePickupsService } from './vehicle-pickups.service';
import { VehiclePickupsRepository } from './vehicle-pickups.repository';
import { WorkOrdersRepository } from '../work-orders/work-orders.repository';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [SecurityModule],
  controllers: [VehiclePickupsController],
  providers: [VehiclePickupsService, VehiclePickupsRepository, WorkOrdersRepository],
  exports: [VehiclePickupsService],
})
export class VehiclePickupsModule {}
