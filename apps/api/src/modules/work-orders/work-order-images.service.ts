import { Injectable, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { NotFoundError, DomainError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from '@mechanic-system/validation';
import type { WorkOrderImageDto } from '@mechanic-system/types';
import type { WorkOrderImageWithUploader } from './work-order-images.repository';
import { WorkOrderImagesRepository } from './work-order-images.repository';
import { StorageService } from '../../common/storage/storage.service';
import { WorkOrdersRepository } from './work-orders.repository';

/**
 * Response MIME types that may be shown inline; anything else downloads.
 */
const INLINE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function toDto(image: WorkOrderImageWithUploader): WorkOrderImageDto {
  return {
    id: image.id,
    workOrderId: image.workOrderId,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    sha256: image.sha256,
    caption: image.caption,
    url: `/work-orders/${image.workOrderId}/images/${image.id}/content`,
    createdAt: image.createdAt.toISOString(),
  };
}

/**
 * Image rules (Fase 6):
 * - images belong to a work order and are deleted with it (Cascade);
 * - type/size are validated from the REAL bytes (never client headers);
 * - the same content is stored once (sha256 addressing) and only removed
 *   when the last DB row referencing it is deleted.
 */
@Injectable()
export class WorkOrderImagesService {
  constructor(
    private readonly imagesRepository: WorkOrderImagesRepository,
    private readonly workOrdersRepository: WorkOrdersRepository,
    private readonly storage: StorageService,
  ) {}

  async upload(
    workOrderId: string,
    file: { buffer: Buffer } | undefined,
    caption: string | null,
    userId: string | null,
  ): Promise<WorkOrderImageDto> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new DomainError(ErrorCodes.VALIDATION_ERROR, 'Nenhum arquivo enviado', 400);
    }
    const workOrder = await this.workOrdersRepository.findById(workOrderId);
    if (!workOrder) {
      throw new NotFoundError(ErrorCodes.WORK_ORDER_NOT_FOUND, 'Ordem de Serviço não encontrada');
    }
    const stored = await this.storage.save(
      file.buffer,
      MAX_IMAGE_SIZE_BYTES,
      ALLOWED_IMAGE_MIME_TYPES,
    );
    const created = await this.imagesRepository.create({
      workOrderId,
      storageKey: stored.storageKey,
      sha256: stored.sha256,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      caption: caption && caption.length > 0 ? caption : null,
      uploadedBy: userId,
    });
    return toDto({ ...created, uploadedByUser: null });
  }

  async list(workOrderId: string): Promise<WorkOrderImageDto[]> {
    const images = await this.imagesRepository.findByWorkOrder(workOrderId);
    return images.map(toDto);
  }

  async getById(workOrderId: string, id: string): Promise<WorkOrderImageDto> {
    const image = await this.imagesRepository.findById(id);
    if (!image || image.workOrderId !== workOrderId) {
      throw new NotFoundError(ErrorCodes.IMAGE_NOT_FOUND, 'Imagem não encontrada');
    }
    return toDto(image);
  }

  /** Streams the raw bytes; called via the URL from the DTO (not enveloped). */
  async download(workOrderId: string, id: string, response: Response): Promise<StreamableFile> {
    const image = await this.imagesRepository.findById(id);
    if (!image || image.workOrderId !== workOrderId) {
      throw new NotFoundError(ErrorCodes.IMAGE_NOT_FOUND, 'Imagem não encontrada');
    }
    const buffer = await this.storage.read(image.storageKey);
    const inline = INLINE_MIME_TYPES.has(image.mimeType);
    response.setHeader('Content-Type', image.mimeType);
    response.setHeader('Content-Length', buffer.length.toString());
    response.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="os-image-${id}"`,
    );
    return new StreamableFile(buffer);
  }

  /** Deletes the metadata row; bytes go only when unreferenced. */
  async remove(workOrderId: string, id: string): Promise<void> {
    const image = await this.imagesRepository.findById(id);
    if (!image || image.workOrderId !== workOrderId) {
      throw new NotFoundError(ErrorCodes.IMAGE_NOT_FOUND, 'Imagem não encontrada');
    }
    await this.imagesRepository.delete(id);
    const remaining = await this.imagesRepository.countReferencesTo(image.storageKey);
    await this.storage.removeIfUnused(image.storageKey, remaining);
  }
}
