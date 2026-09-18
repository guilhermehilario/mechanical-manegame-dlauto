import { Module } from '@nestjs/common';
import { CatalogSeedController } from './catalog-seed.controller';
import { CatalogSeedService } from './catalog-seed.service';

@Module({
  controllers: [CatalogSeedController],
  providers: [CatalogSeedService],
})
export class CatalogSeedModule {}