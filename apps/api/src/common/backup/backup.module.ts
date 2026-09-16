import { Module } from '@nestjs/common';
import { loadEnv } from '@mechanic-system/config';
import { BackupService } from './backup.service';
import { BackupsController } from './backup.controller';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Local backup/restore (Fase 10). PrismaModule is @Global (same instance
 * everywhere — mandatory for $disconnect/$connect around the file swap);
 * env is re-parsed in the factory (bootstrap copies validated values into
 * process.env).
 */
@Module({
  controllers: [BackupsController],
  providers: [
    {
      provide: BackupService,
      useFactory: (prisma: PrismaService) => new BackupService(prisma, loadEnv()),
      inject: [PrismaService],
    },
  ],
  exports: [BackupService],
})
export class BackupModule {}
