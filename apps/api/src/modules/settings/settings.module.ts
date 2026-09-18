import { Module } from '@nestjs/common';
import { loadEnv } from '@mechanic-system/config';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SecurityModule } from '../auth/security.module';
import { PrismaService } from '../../prisma/prisma.service';

/** Shop settings singleton (Bloco F2 mínimo — printed documents header) +
 * runtime backup config (Bloco E/E2). */
@Module({
  imports: [SecurityModule],
  controllers: [SettingsController],
  providers: [
    {
      provide: SettingsService,
      useFactory: (prisma: PrismaService) => new SettingsService(prisma, loadEnv()),
      inject: [PrismaService],
    },
  ],
  exports: [SettingsService],
})
export class SettingsModule {}
