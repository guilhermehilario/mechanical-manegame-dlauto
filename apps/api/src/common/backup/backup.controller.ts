import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import type { BackupConfigDto, BackupDto, CreateBackupResultDto, RestoreResultDto } from '@mechanic-system/types';
import {
  backupConfigSchema,
  backupIdParamSchema,
  restoreBackupSchema,
  type BackupConfigInput,
  type RestoreBackupInput,
} from './backup-validation';
import { BackupSchedulerService } from './backup-scheduler.service';
import { BackupService } from './backup.service';
import { RequireRoles, RolesGuard } from '../../modules/auth/roles.guard';

/**
 * Backup/restore (Fase 10, spec §3) — ADMIN only: backups contain the whole
 * business dataset (PII + finance), and restore REPLACES the live data.
 * The global JwtAuthGuard (R5) already requires a valid session; the
 * RolesGuard restricts to ADMIN.
 *
 * 2026-09-18: runtime backup config (GET/PUT /backups/config) lets the
 * operator change interval/keep/alert/enable from the settings screen
 * without restarting.
 */
@UseGuards(RolesGuard)
@RequireRoles('ADMIN')
@Controller('backups')
export class BackupsController {
  constructor(
    private readonly backups: BackupService,
    private readonly scheduler: BackupSchedulerService,
  ) {}

  /**
   * Backup health for the dashboard banner (Bloco E/E2). Deliberately
   * class-level ADMIN like the rest of the controller: the status leaks
   * backup timestamps/PII-adjacent metadata, and the dashboard itself is
   * already ADMIN/MANAGER (R3).
   */
  @Get('status')
  status() {
    return this.scheduler.getStatus();
  }

  // ─── Runtime configuration (2026-09-18) ──────────────────────────────────

  /** Effective backup configuration (DB overrides env when saved). */
  @Get('config')
  getConfig(): Promise<BackupConfigDto> {
    return this.scheduler.getConfig();
  }

  /** Persist new backup configuration and reschedule immediately. */
  @Put('config')
  @HttpCode(HttpStatus.OK)
  async updateConfig(
    @Body(new ZodValidationPipe(backupConfigSchema)) input: BackupConfigInput,
  ): Promise<BackupConfigDto> {
    await this.scheduler.updateAndReschedule(input);
    return this.scheduler.getConfig();
  }

  // ─── Manual backup / list ────────────────────────────────────────────────

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