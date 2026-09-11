import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupsController } from './backup.controller';

/**
 * Local backup/restore (Fase 10). Depends only on the global PrismaModule
 * and the validated Env — no domain-module coupling.
 */
@Module({
  controllers: [BackupsController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
