import { Module } from '@nestjs/common';
import { loadEnv } from '@mechanic-system/config';
import { BackupService } from './backup.service';
import { BackupSchedulerService } from './backup-scheduler.service';
import { BackupsController } from './backup.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsModule } from '../../modules/settings/settings.module';
import { SettingsService } from '../../modules/settings/settings.service';

/**
 * Local backup/restore (Fase 10) + automatic scheduler (Bloco E). PrismaModule
 * is @Global (same instance everywhere — mandatory for $disconnect/$connect
 * around the file swap); env is re-parsed in the factories (bootstrap copies
 * validated values into process.env). The scheduler now reads runtime config
 * from `shop_settings` via SettingsService (env fallback).
 */
@Module({
  imports: [SettingsModule],
  controllers: [BackupsController],
  providers: [
    {
      provide: BackupService,
      useFactory: (prisma: PrismaService) => new BackupService(prisma, loadEnv()),
      inject: [PrismaService],
    },
    {
      provide: BackupSchedulerService,
      useFactory: (backupService: BackupService, settings: SettingsService) =>
        new BackupSchedulerService(backupService, settings),
      inject: [BackupService, SettingsService],
    },
  ],
  exports: [BackupService, BackupSchedulerService],
})
export class BackupModule {}
