import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StockService } from './stock.service';
import { ProductsRepository } from './products.repository';
import { SuppliersRepository } from '../suppliers/suppliers.repository';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [SecurityModule],
  controllers: [ProductsController],
  providers: [ProductsService, StockService, ProductsRepository, SuppliersRepository],
  exports: [StockService],
})
export class ProductsModule {}
