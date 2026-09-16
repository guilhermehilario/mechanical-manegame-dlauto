import { Global, Module } from '@nestjs/common';
import { loadEnv } from '@mechanic-system/config';
import { PermissionsService } from './permissions.service';

/**
 * R7/SEC-07 boot hardening (Fase 10): restrictive permissions on every
 * local-data directory (database, uploads, backups). Global so any module
 * can inject PermissionsService. The env is re-parsed in the factory
 * (bootstrap copies validated values into process.env — same config).
 */
@Global()
@Module({
  providers: [{ provide: PermissionsService, useFactory: () => new PermissionsService(loadEnv()) }],
  exports: [PermissionsService],
})
export class HardeningModule {}
