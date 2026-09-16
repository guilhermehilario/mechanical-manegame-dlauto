import { Module } from '@nestjs/common';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrderImagesController } from './work-order-images.controller';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrderImagesService } from './work-order-images.service';
import { WorkOrdersRepository } from './work-orders.repository';
import { WorkOrderImagesRepository } from './work-order-images.repository';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { ServicesRepository } from '../services/services.repository';
import { ProductsRepository } from '../products/products.repository';
import { StockService } from '../products/stock.service';
import { StorageModule } from '../../common/storage/storage.module';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [SecurityModule, StorageModule],
  controllers: [WorkOrdersController, WorkOrderImagesController],
  providers: [
    WorkOrdersService,
    WorkOrderImagesService,
    WorkOrdersRepository,
    WorkOrderImagesRepository,
    VehiclesRepository,
    ServicesRepository,
    ProductsRepository,
    StockService,
  ],
  exports: [WorkOrdersService, WorkOrdersRepository],
})
export class WorkOrdersModule {}
