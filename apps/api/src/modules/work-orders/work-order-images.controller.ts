import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  imageCaptionSchema,
  workOrderIdSchema,
  workOrderImageIdSchema,
} from '@mechanic-system/validation';
import type { WorkOrderImageDto } from '@mechanic-system/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';
import { WorkOrderImagesService } from './work-order-images.service';

/** Minimal shape of the multer memory-storage file (no @types/multer dep). */
interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/** Images are shop floor evidence: all roles may view/upload, fewer delete. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('work-orders/:workOrderId/images')
export class WorkOrderImagesController {
  constructor(private readonly imagesService: WorkOrderImagesService) {}

  @Get()
  list(
    @Param('workOrderId', new ZodValidationPipe(workOrderIdSchema, 'param')) workOrderId: string,
  ): Promise<WorkOrderImageDto[]> {
    return this.imagesService.list(workOrderId);
  }

  /** Raw bytes — bypasses the JSON envelope via StreamableFile. */
  @Get(':id/content')
  download(
    @Param('workOrderId', new ZodValidationPipe(workOrderIdSchema, 'param')) workOrderId: string,
    @Param('id', new ZodValidationPipe(workOrderImageIdSchema, 'param')) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.imagesService.download(workOrderId, id, response);
  }

  @Get(':id')
  getById(
    @Param('workOrderId', new ZodValidationPipe(workOrderIdSchema, 'param')) workOrderId: string,
    @Param('id', new ZodValidationPipe(workOrderImageIdSchema, 'param')) id: string,
  ): Promise<WorkOrderImageDto> {
    return this.imagesService.getById(workOrderId, id);
  }

  @Post()
  @RequireRoles('ADMIN', 'MANAGER', 'ATTENDANT', 'MECHANIC')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(), // bytes validated by StorageService from memory
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  upload(
    @Req() request: AuthenticatedRequest,
    @Param('workOrderId', new ZodValidationPipe(workOrderIdSchema, 'param')) workOrderId: string,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Body('caption', new ZodValidationPipe(imageCaptionSchema)) caption?: string,
  ): Promise<WorkOrderImageDto> {
    const userId = request.user?.id ?? null;
    return this.imagesService.upload(workOrderId, file, caption ?? null, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRoles('ADMIN', 'MANAGER')
  async remove(
    @Param('workOrderId', new ZodValidationPipe(workOrderIdSchema, 'param')) workOrderId: string,
    @Param('id', new ZodValidationPipe(workOrderImageIdSchema, 'param')) id: string,
  ): Promise<void> {
    await this.imagesService.remove(workOrderId, id);
  }
}
