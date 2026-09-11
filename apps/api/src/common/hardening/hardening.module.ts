import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

/**
 * R7/SEC-07 boot hardening (Fase 10): restrictive permissions on every
 * local-data directory (database, uploads, backups). Global so any module
 * can inject PermissionsService (e.g. to create new private subdirs).
 */
@Global()
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class HardeningModule {}
