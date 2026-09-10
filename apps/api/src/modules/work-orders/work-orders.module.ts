import { Module } from '@nestjs/common';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrdersRepository } from './work-orders.repository';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { ServicesRepository } from '../services/services.repository';
import { ProductsRepository } from '../products/products.repository';
import { StockService } from '../products/stock.service';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [SecurityModule],
  controllers: [WorkOrdersController],
  providers: [
    WorkOrdersService,
    WorkOrdersRepository,
    VehiclesRepository,
    ServicesRepository,
    ProductsRepository,
    StockService,
  ],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
