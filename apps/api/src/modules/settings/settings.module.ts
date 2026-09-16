import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SecurityModule } from '../auth/security.module';

/** Shop settings singleton (Bloco F2 mínimo — printed documents header). */
@Module({
  imports: [SecurityModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
