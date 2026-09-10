import { Injectable } from '@nestjs/common';
import type { Prisma, WorkOrderImage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Image row with uploader display name for listing. */
export type WorkOrderImageWithUploader = Prisma.WorkOrderImageGetPayload<{
  include: { uploadedByUser: { select: { name: true } } };
}>;

/**
 * Data access for work order images (Fase 6). No business rules here —
 * the service decides what to persist; bytes live in the StorageService.
 */
@Injectable()
export class WorkOrderImagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    workOrderId: string;
    storageKey: string;
    sha256: string;
    mimeType: string;
    sizeBytes: number;
    caption: string | null;
    uploadedBy: string | null;
  }): Promise<WorkOrderImage> {
    return this.prisma.workOrderImage.create({ data });
  }

  findById(id: string): Promise<WorkOrderImageWithUploader | null> {
    return this.prisma.workOrderImage.findFirst({
      where: { id },
      include: { uploadedByUser: { select: { name: true } } },
    });
  }

  findByWorkOrder(workOrderId: string): Promise<WorkOrderImageWithUploader[]> {
    return this.prisma.workOrderImage.findMany({
      where: { workOrderId },
      orderBy: { createdAt: 'asc' },
      include: { uploadedByUser: { select: { name: true } } },
    });
  }

  /** How many rows reference the same content (for safe garbage collection). */
  countReferencesTo(storageKey: string): Promise<number> {
    return this.prisma.workOrderImage.count({ where: { storageKey } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.workOrderImage.delete({ where: { id } });
  }
}
