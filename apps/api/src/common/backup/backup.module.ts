import { Module } from '@nestjs/common';
import { loadEnv } from '@mechanic-system/config';
import { BackupService } from './backup.service';
import { BackupSchedulerService } from './backup-scheduler.service';
import { BackupsController } from './backup.controller';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Local backup/restore (Fase 10) + automatic scheduler (Bloco E). PrismaModule
 * is @Global (same instance everywhere — mandatory for $disconnect/$connect
 * around the file swap); env is re-parsed in the factories (bootstrap copies
 * validated values into process.env).
 */
@Module({
  controllers: [BackupsController],
  providers: [
    {
      provide: BackupService,
      useFactory: (prisma: PrismaService) => new BackupService(prisma, loadEnv()),
      inject: [PrismaService],
    },
    {
      provide: BackupSchedulerService,
      useFactory: (backupService: BackupService) =>
        new BackupSchedulerService(backupService, loadEnv()),
      inject: [BackupService],
    },
  ],
  exports: [BackupService, BackupSchedulerService],
})
export class BackupModule {}
