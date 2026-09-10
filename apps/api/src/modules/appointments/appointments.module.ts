import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentsRepository } from './appointments.repository';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { ServicesRepository } from '../services/services.repository';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [SecurityModule],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    AppointmentsRepository,
    VehiclesRepository,
    ServicesRepository,
  ],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
