import { Module } from '@nestjs/common';
import { loadEnv } from '@mechanic-system/config';
import { StorageService } from './storage.service';

/**
 * Provides the disk-backed StorageService (Fase 6). The storage root comes
 * from validated env (STORAGE_DIR); bootstrap copies validated values into
 * process.env, so re-parsing here sees the same configuration.
 */
@Module({
  providers: [{ provide: StorageService, useFactory: () => new StorageService(loadEnv()) }],
  exports: [StorageService],
})
export class StorageModule {}
