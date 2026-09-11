import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import type { BackupDto, CreateBackupResultDto, RestoreResultDto } from '@mechanic-system/types';
import {
  backupIdParamSchema,
  restoreBackupSchema,
  type RestoreBackupInput,
} from './backup-validation';
import { BackupService } from './backup.service';
import { RequireRoles, RolesGuard } from '../../modules/auth/roles.guard';

/**
 * Backup/restore (Fase 10, spec §3) — ADMIN only: backups contain the whole
 * business dataset (PII + finance), and restore REPLACES the live data.
 * The global JwtAuthGuard (R5) already requires a valid session; the
 * RolesGuard restricts to ADMIN.
 */
@UseGuards(RolesGuard)
@RequireRoles('ADMIN')
@Controller('backups')
export class BackupsController {
  constructor(private readonly backups: BackupService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(): Promise<CreateBackupResultDto> {
    return this.backups.create().then((backup) => ({ backup }));
  }

  @Get()
  list(): Promise<BackupDto[]> {
    return this.backups.list();
  }

  @Get(':id')
  readOne(@Param('id', new ZodValidationPipe(backupIdParamSchema, 'param')) id: string): Promise<BackupDto> {
    return this.backups.readOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', new ZodValidationPipe(backupIdParamSchema, 'param')) id: string,
  ): Promise<void> {
    await this.backups.remove(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(
    @Param('id', new ZodValidationPipe(backupIdParamSchema, 'param')) id: string,
    @Body(new ZodValidationPipe(restoreBackupSchema)) _input: RestoreBackupInput,
  ): Promise<RestoreResultDto> {
    return this.backups.restore(id);
  }
}
