import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { shopSettingsSchema } from '@mechanic-system/validation';
import type { ShopSettingsInput } from '@mechanic-system/validation';
import type { ShopSettingsDto } from '@mechanic-system/types';
import { SettingsService } from './settings.service';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';

/**
 * Shop settings (Bloco F2 mínimo). Reading is open to every role (any user
 * may print documents); editing is ADMIN/MANAGER.
 */
@UseGuards(RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(): Promise<ShopSettingsDto> {
    return this.settingsService.get();
  }

  @Put()
  @RequireRoles('ADMIN', 'MANAGER')
  update(
    @Body(new ZodValidationPipe(shopSettingsSchema)) input: ShopSettingsInput,
  ): Promise<ShopSettingsDto> {
    return this.settingsService.update(input);
  }
}
