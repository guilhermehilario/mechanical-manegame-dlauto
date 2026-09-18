import { Controller, Post, UseGuards } from '@nestjs/common';
import type { SeedCatalogResultDto } from '@mechanic-system/types';
import { CatalogSeedService } from './catalog-seed.service';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';

/**
 * Optional example catalog (Bloco F/F3). Explicit opt-in — nothing is seeded
 * automatically. Restricted to ADMIN/MANAGER (management decision).
 */
@UseGuards(RolesGuard)
@Controller('catalog')
export class CatalogSeedController {
  constructor(private readonly catalogSeedService: CatalogSeedService) {}

  @Post('seed-examples')
  @RequireRoles('ADMIN', 'MANAGER')
  seedExamples(): Promise<SeedCatalogResultDto> {
    return this.catalogSeedService.seed();
  }
}